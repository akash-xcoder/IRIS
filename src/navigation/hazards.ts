import type { DetectResult, SegmentResult } from '../yolo/types'
import { distancePhrase, groundDistance } from './distance'
import { sceneHazards } from './scene'

export type Side = 'left' | 'ahead' | 'right'

export interface Hazard {
  name: string
  side: Side
  /** Box height (or area share) in the frame: a rough stand-in for distance. */
  size: number
  near: boolean
  /** Metres away, when it can be estimated from where it meets the ground. */
  distance?: number | null
  /** For a barrier ahead: the side that looks clear instead, if any. */
  open?: Side | null
  /** Something you'd walk into face first (a wall, a door, a fence) rather than an object. */
  barrier?: boolean
}

// COCO classes that block a path or move into it. Small things (cups, phones) aren't worth a warning.
const OBSTACLES = new Set([
  'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck', 'train',
  'dog', 'cat', 'horse', 'cow', 'sheep', 'elephant',
  'bench', 'chair', 'couch', 'dining table', 'bed', 'potted plant', 'fire hydrant',
  'parking meter', 'stop sign', 'suitcase', 'skateboard', 'toilet', 'refrigerator',
  // From the hazard detector.
  'ladder',
])

/** Hazards on the ground. They're flat, so how low they sit in the frame says how close they are. */
const GROUND = new Set(['pothole', 'open manhole'])
/** Box bottoms (share of frame height) at which a ground hazard is in the way, and close. */
const GROUND_AHEAD = 0.55
const GROUND_NEAR = 0.8

/** Box heights (share of frame) at which something counts as in the way, and as close. */
const AHEAD_SIZE = 0.28
const SIDE_SIZE = 0.42
const NEAR_SIZE = 0.5

/**
 * How dangerous each kind of hazard is, for ordering and for whether it may interrupt speech.
 * Fire and drops can't wait; anything else waits for the current sentence to finish.
 */
const DANGER: Record<string, number> = { fire: 10, edge: 9, balcony: 8, water: 6, stairs: 5, pothole: 5, 'open manhole': 5 }
const URGENT = 8

export const isUrgent = (h: Hazard) => (DANGER[h.name] ?? 0) >= URGENT

/** The obstacles worth mentioning in this frame, most pressing first. */
export function findHazards(result: DetectResult, names: string[]): Hazard[] {
  const hazards: Hazard[] = []
  for (const d of result.detections) {
    const name = names[d.classId]
    if (!name || !(OBSTACLES.has(name) || GROUND.has(name))) continue
    const [x1, y1, x2, y2] = d.box
    const cx = (x1 + x2) / 2 / result.width
    const side: Side = cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : 'ahead'
    // Most obstacles stand on the ground, so the bottom of the box is where they are.
    const distance = y2 / result.height < 0.98 ? groundDistance(y2 / result.height, result.width, result.height) : null
    if (GROUND.has(name)) {
      const bottom = y2 / result.height
      if (bottom >= GROUND_AHEAD) hazards.push({ name, side, size: bottom, near: bottom >= GROUND_NEAR, distance })
      continue
    }
    const size = (y2 - y1) / result.height
    if (size < (side === 'ahead' ? AHEAD_SIZE : SIDE_SIZE)) continue
    hazards.push({ name, side, size, near: size >= NEAR_SIZE || (distance !== null && distance < 1.2), distance })
  }
  return hazards.sort(mostPressing)
}

// Fire and drops first, then whatever is close, then what's straight ahead, then the biggest.
const danger = (h: Hazard) => (DANGER[h.name] ?? 1) + (h.near ? 3 : 0) + (h.side === 'ahead' ? 1 : 0)
const mostPressing = (a: Hazard, b: Hazard) => danger(b) - danger(a) || b.size - a.size

/** Shares of the walking zone that stairs must cover to be mentioned, and to count as close. */
const STAIRS_SHARE = 0.04
const STAIRS_NEAR_SHARE = 0.12

/**
 * Stairs from the surface model's label map. Only the bottom half of the frame counts: that's
 * the ground just ahead, so a staircase across the room isn't announced.
 */
export function findStairs(seg: SegmentResult, classIds: readonly number[]): Hazard | null {
  if (!classIds.length) return null
  const isStair = new Uint8Array(256)
  for (const id of classIds) isStair[id] = 1
  const { labels, labelWidth: w, labelHeight: h } = seg
  const top = Math.floor(h / 2)
  const nearTop = Math.floor(h * 0.75)
  let count = 0
  let near = 0
  let sumX = 0
  let lowest = 0
  for (let y = top; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isStair[labels[y * w + x]]) continue
      count++
      sumX += x
      if (y >= nearTop) near++
      if (y > lowest) lowest = y
    }
  }
  const share = count / ((h - top) * w)
  if (share < STAIRS_SHARE) return null
  const cx = sumX / count / w
  const side: Side = cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : 'ahead'
  // The first step is the lowest stair pixel; it's on the ground, so it gives the distance.
  const distance = lowest < h - 1 ? groundDistance(lowest / h, seg.width, seg.height) : null
  return { name: 'stairs', side, size: share, near: near / ((h - nearTop) * w) >= STAIRS_NEAR_SHARE, distance }
}

export interface HazardSources {
  objects: DetectResult | null
  names: string[]
  surfaces: SegmentResult | null
  stairClasses: readonly number[]
  /** The surface model's class names, for walls, edges and water. */
  surfaceNames?: readonly string[]
  /** From the hazard detector, e.g. potholes and ladders. */
  detected?: DetectResult | null
  detectedNames?: string[]
  fire?: Hazard | null
}

/** Every hazard in the latest frame, from every model, most pressing first. */
export function allHazards(s: HazardSources): Hazard[] {
  const stairs = s.surfaces ? findStairs(s.surfaces, s.stairClasses) : null
  return [
    ...(s.fire ? [s.fire] : []),
    ...(stairs ? [stairs] : []),
    ...(s.surfaces && s.surfaceNames?.length ? sceneHazards(s.surfaces, s.surfaceNames) : []),
    ...(s.objects ? findHazards(s.objects, s.names) : []),
    ...(s.detected ? findHazards(s.detected, s.detectedNames ?? []) : []),
  ].sort(mostPressing)
}

const where = (h: Hazard) => (h.side === 'ahead' ? 'ahead' : `on your ${h.side}`)
const away = (h: Hazard) => (h.distance ? `, ${distancePhrase(h.distance)}` : '')
const turn = (side: Side | null | undefined) =>
  side === 'left' || side === 'right' ? ` The way is clear on your ${side}. Turn ${side}.` : ' Turn around, or feel for a way past.'

export function hazardPhrase(h: Hazard): string {
  switch (h.name) {
    case 'fire':
      return h.side === 'ahead' ? 'Danger! Fire ahead. Stop and move back.' : `Danger! Fire on your ${h.side}. Move away from it.`
    case 'edge':
      return `Stop! The ground ends ahead${away(h)}. There may be a drop.`
    case 'balcony':
      return 'Careful, railing ahead. This looks like a balcony edge. Do not lean over.'
    case 'water':
      return 'Careful, water ahead.'
    case 'stairs':
      return h.near
        ? `Careful, stairs ${where(h)}${away(h)}. Slow down and find the handrail.`
        : `Stairs ${where(h)}${away(h)}.`
  }
  if (GROUND.has(h.name)) return h.near ? `Careful, ${h.name} ${where(h)}${away(h)}. Step around it.` : `${capitalize(h.name)} ${where(h)}${away(h)}.`
  if (h.barrier && h.name === 'door') return `Door ahead${away(h)}. Reach out for the handle.`
  if (h.barrier) {
    const thing = h.name === 'wall' ? 'Wall' : capitalize(h.name)
    return h.near ? `Stop. ${thing} in front of you${away(h)}.${turn(h.open)}` : `${thing} ahead${away(h)}.${h.open ? turn(h.open) : ''}`
  }
  if (h.side === 'ahead') return h.near ? `Slow down, ${h.name} ahead${away(h)}.` : `${capitalize(h.name)} ahead${away(h)}.`
  return `${capitalize(h.name)} on your ${h.side}.`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const REPEAT_MS = 8000
const GAP_MS = 3000
/** Fire and drops are repeated sooner, for as long as they're there. */
const URGENT_REPEAT_MS = 4000

/** Decides when to speak a hazard, so a person standing ahead isn't announced on every frame. */
export class HazardAnnouncer {
  private lastSaid = new Map<string, number>()
  private lastAny = -Infinity

  /** Returns the hazard to announce now, if any. Urgent ones skip the pause between warnings. */
  pick(hazards: Hazard[], now = performance.now()): Hazard | null {
    for (const h of hazards) {
      const urgent = isUrgent(h)
      if (!urgent && now - this.lastAny < GAP_MS) continue
      const key = `${h.name}:${h.side}:${h.near}`
      if (now - (this.lastSaid.get(key) ?? -Infinity) < (urgent ? URGENT_REPEAT_MS : REPEAT_MS)) continue
      this.lastSaid.set(key, now)
      this.lastAny = now
      return h
    }
    return null
  }

  reset() {
    this.lastSaid.clear()
    this.lastAny = -Infinity
  }
}

/** A buzz on phones that support it: double when close, long and repeated for fire and drops. */
export function buzz(h: Hazard) {
  navigator.vibrate?.(isUrgent(h) ? [500, 150, 500, 150, 500] : h.near ? [250, 100, 250] : 150)
}
