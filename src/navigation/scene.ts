import type { SegmentResult } from '../yolo/types'
import { groundDistance } from './distance'
import type { Hazard, Side } from './hazards'

/**
 * Reads the surface model's label map (ADE20K classes) for dangers no box detector sees: a wall
 * or other barrier in the way, an open edge such as a balcony or platform, and water.
 *
 * Every column is scanned from the bottom of the frame up. The bottom is the ground at the user's
 * feet, so the first thing that isn't walkable ground is the first thing they'd reach, and how
 * high up the frame it starts says how far away it is.
 */

/** Ground you can walk on. */
const WALKABLE = ['floor', 'road', 'sidewalk', 'path', 'rug', 'earth', 'grass', 'field', 'sand', 'land', 'dirt track', 'runway', 'step', 'stairs', 'stairway']
/** Things that stop you and that you'd walk into face first. */
const BARRIERS = ['wall', 'building', 'house', 'skyscraper', 'fence', 'railing', 'bannister', 'column', 'cabinet', 'wardrobe', 'windowpane', 'glass', 'mirror', 'screen door', 'door', 'bookcase', 'shelf', 'refrigerator', 'counter', 'kitchen island']
/** What you see past an edge: open air or the far side of a drop. */
const BEYOND_EDGE = ['sky', 'tree', 'palm', 'mountain', 'hill', 'building', 'skyscraper', 'house', 'tower']
const RAILINGS = ['railing', 'bannister', 'fence']
const WATER = ['water', 'sea', 'river', 'lake', 'swimming pool', 'waterfall']

/** Ignore anything higher than this in the frame: it's far off, or above the ground entirely. */
const HORIZON = 0.35
/** Share of a third's columns that must be blocked for that direction to count as blocked. */
const BLOCKED_SHARE = 0.6
/** A direction is clear when this share of its columns runs into nothing before the horizon. */
const CLEAR_SHARE = 0.55
/**
 * Closer than this, a wall is a "stop" rather than a heads-up. A phone at chest height can't see
 * the ground much closer than 1.5 m, so this is about three or four steps.
 */
export const WALL_NEAR_M = 2.5
const WALL_MAX_M = 6
/** Share of centre columns where the ground ends in open air, for an edge warning. */
const EDGE_SHARE = 0.35
const WATER_SHARE = 0.12

function classSet(names: readonly string[], wanted: readonly string[]): Uint8Array {
  const set = new Uint8Array(256)
  for (const n of wanted) {
    const i = names.indexOf(n)
    if (i >= 0) set[i] = 1
  }
  return set
}

/** The surface model's label sets, worked out once per class list. */
const cache = new WeakMap<readonly string[], Record<'walk' | 'barrier' | 'beyond' | 'railing' | 'water', Uint8Array>>()
function sets(names: readonly string[]) {
  let s = cache.get(names)
  if (!s) {
    s = {
      walk: classSet(names, WALKABLE),
      barrier: classSet(names, BARRIERS),
      beyond: classSet(names, BEYOND_EDGE),
      railing: classSet(names, RAILINGS),
      water: classSet(names, WATER),
    }
    cache.set(names, s)
  }
  return s
}

interface Column {
  /** Row (share of height) where the first non-ground thing starts, scanning up; null if none below the horizon. */
  hit: number | null
  label: number
  /** The ground ended in open air rather than a barrier. */
  edge: boolean
}

function scanColumn(seg: SegmentResult, x: number, s: ReturnType<typeof sets>): Column {
  const { labels, labelWidth: w, labelHeight: h } = seg
  const stop = Math.floor(h * HORIZON)
  let sawGround = false
  for (let y = h - 1; y >= stop; y--) {
    const label = labels[y * w + x]
    if (s.walk[label]) {
      sawGround = true
      continue
    }
    if (s.barrier[label]) return { hit: y / h, label, edge: false }
    // Ground that gives way to sky or treetops below the horizon: there's a drop in between.
    if (sawGround && s.beyond[label] && y / h > 0.5) return { hit: y / h, label, edge: true }
  }
  return { hit: null, label: -1, edge: false }
}

const sideOf = (i: number): Side => (i === 0 ? 'left' : i === 1 ? 'ahead' : 'right')

/** Walls, edges and water in this frame, as hazards. */
export function sceneHazards(seg: SegmentResult, names: readonly string[]): Hazard[] {
  const s = sets(names)
  const { labels, labelWidth: w, labelHeight: h } = seg
  const step = Math.max(1, Math.floor(w / 48))
  const thirds: Column[][] = [[], [], []]
  for (let x = 0; x < w; x += step) thirds[Math.min(2, Math.floor((x / w) * 3))].push(scanColumn(seg, x, s))

  const hazards: Hazard[] = []
  const centre = thirds[1]

  // An edge: in the centre, the ground runs out into open air.
  const edges = centre.filter((c) => c.edge)
  if (edges.length >= centre.length * EDGE_SHARE) {
    const y = median(edges.map((c) => c.hit!))
    const distance = groundDistance(y, seg.width, seg.height)
    hazards.push({ name: 'edge', side: 'ahead', size: edges.length / centre.length, near: true, distance })
  }

  // A railing across the way with open air above or beyond it: a balcony or a drop.
  let railing = 0
  let beyond = 0
  let water = 0
  const x0 = Math.floor(w / 3)
  const x1 = Math.floor((2 * w) / 3)
  const yTop = Math.floor(h * HORIZON)
  for (let y = yTop; y < h; y++) {
    for (let x = x0; x < x1; x += step) {
      const label = labels[y * w + x]
      if (s.railing[label]) railing++
      else if (s.beyond[label]) beyond++
      if (s.water[label] && y > h / 2) water++
    }
  }
  const area = ((h - yTop) * (x1 - x0)) / step
  if (!hazards.length && railing / area > 0.08 && beyond / area > 0.12) {
    hazards.push({ name: 'balcony', side: 'ahead', size: railing / area, near: true, distance: null })
  }
  if (water / (area / 2) > WATER_SHARE) {
    hazards.push({ name: 'water', side: 'ahead', size: water / area, near: true, distance: null })
  }

  // A wall (or door, fence, cupboard) blocking the way ahead, and which side is open instead.
  // A barrier only counts once it's measurably close: one at the horizon is the far end of a room.
  // A balcony's railing has already been announced as the balcony.
  const balcony = hazards.some((h) => h.name === 'balcony' || h.name === 'edge')
  const blocked = centre.filter((c) => c.hit !== null && !c.edge && !(balcony && s.railing[c.label]))
  if (blocked.length >= centre.length * BLOCKED_SHARE) {
    const y = median(blocked.map((c) => c.hit!))
    const distance = groundDistance(y, seg.width, seg.height)
    if (distance !== null && distance <= WALL_MAX_M) {
      const clear = [0, 2]
        .map((i) => ({ i, share: thirds[i].filter((c) => c.hit === null || c.hit < 0.5).length / Math.max(1, thirds[i].length) }))
        .filter((t) => t.share >= CLEAR_SHARE)
        .sort((a, b) => b.share - a.share)
      const label = names[mode(blocked.map((c) => c.label))] ?? 'wall'
      hazards.push({
        name: label === 'windowpane' || label === 'glass' ? 'glass wall' : label,
        side: 'ahead',
        size: blocked.length / centre.length,
        near: distance <= WALL_NEAR_M,
        distance,
        open: clear.length ? sideOf(clear[0].i) : null,
        barrier: true,
      })
    }
  }
  return hazards
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function mode(values: number[]): number {
  const counts = new Map<number, number>()
  let best = values[0]
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1
    counts.set(v, n)
    if (n > (counts.get(best) ?? 0)) best = v
  }
  return best
}
