import type { SegmentResult } from '../yolo/types'
import type { Hazard, Side } from './hazards'
import { sceneHazards, WALL_NEAR_M } from './scene'

/**
 * Smooths walls, edges and water over the last few frames. One frame's label map can miss a wall
 * or see one that isn't there (a shadow, a big poster); a hazard is only reported once most recent
 * frames agree, and its distance is the median of theirs, so it doesn't jump around.
 */

/** Frames remembered, and how many of them must show a hazard for it to count. */
const WINDOW = 6
const QUORUM = 4
/** Drops can't wait for a full quorum. */
const URGENT_QUORUM = 2
const URGENT = new Set(['edge', 'balcony'])

type Key = string
const keyOf = (h: Hazard) => (h.barrier ? 'barrier' : h.name)

export class SceneTracker {
  private history: Map<Key, Hazard>[] = []
  private lastSeg: SegmentResult | null = null
  private lastOut: Hazard[] = []

  /** The steady scene hazards as of this label map. Calling it again for the same map is free. */
  update(seg: SegmentResult, names: readonly string[]): Hazard[] {
    if (seg === this.lastSeg) return this.lastOut
    this.lastSeg = seg
    const now = new Map<Key, Hazard>()
    for (const h of sceneHazards(seg, names)) now.set(keyOf(h), h)
    this.history = [...this.history, now].slice(-WINDOW)

    const out: Hazard[] = []
    const keys = new Set(this.history.flatMap((frame) => [...frame.keys()]))
    for (const key of keys) {
      const seen = this.history.map((frame) => frame.get(key)).filter((h): h is Hazard => h !== undefined)
      const latest = now.get(key)
      // Only report what's still in view: a wall that just left the frame is behind a turn.
      if (!latest) continue
      if (seen.length < (URGENT.has(latest.name) ? URGENT_QUORUM : QUORUM)) continue
      const distances = seen.map((h) => h.distance).filter((d): d is number => d != null)
      const distance = distances.length ? median(distances) : null
      out.push({
        ...latest,
        distance,
        near: latest.barrier && distance !== null ? distance <= WALL_NEAR_M : latest.near,
        open: latest.barrier ? commonest(seen.map((h) => h.open ?? null)) : latest.open,
      })
    }
    this.lastOut = out
    return out
  }

  reset() {
    this.history = []
    this.lastSeg = null
    this.lastOut = []
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function commonest(values: (Side | null)[]): Side | null {
  const counts = new Map<Side | null, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
