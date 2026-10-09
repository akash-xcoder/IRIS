import type { Hazard, Side } from './hazards'

/**
 * Spots flames by colour and flicker. None of the models know "fire", but flames are distinctive:
 * very bright, red-orange to yellow, with little blue, and their outline changes from one moment
 * to the next. Steady orange things (a shirt, a traffic cone, a sunset) have the colour but not
 * the flicker, so on live video both are required. A still photo can't flicker, so there it
 * takes a larger patch of flame colour.
 */

/** The frame is shrunk to this width first: flames are big enough, and it keeps this cheap. */
const WIDTH = 64
/** Share of the frame that must look like flame. Above MAX it's the lighting, not a fire. */
const MIN_SHARE = 0.004
const PHOTO_MIN_SHARE = 0.012
const MAX_SHARE = 0.55
/** Share of flame pixels that must change between samples to count as flickering. */
const FLICKER = 0.25
/** Of the last WINDOW samples, this many must show flickering flame. */
const WINDOW = 4
const NEEDED = 3
/** A fire this big in the frame is close. */
const NEAR_SHARE = 0.05

const isFlame = (r: number, g: number, b: number) => r > 200 && g > 90 && g <= r && b < g * 0.6 && b < 160

export class FireDetector {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private previous: Uint8Array | null = null
  private recent: boolean[] = []

  /** Checks one frame. On live video, call it a few times a second so flicker can be judged. */
  check(media: HTMLVideoElement | HTMLImageElement, live: boolean): Hazard | null {
    const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
    const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
    if (!mw || !mh) return null
    const height = Math.max(1, Math.round((WIDTH * mh) / mw))
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    }
    if (!this.ctx) return null
    if (this.canvas.width !== WIDTH || this.canvas.height !== height) {
      this.canvas.width = WIDTH
      this.canvas.height = height
      this.previous = null
    }
    this.ctx.drawImage(media, 0, 0, WIDTH, height)
    return this.analyze(this.ctx.getImageData(0, 0, WIDTH, height).data, height, live)
  }

  /** The colour and flicker test on one frame's RGBA pixels, WIDTH wide. */
  analyze(data: Uint8ClampedArray, height: number, live: boolean): Hazard | null {
    if (this.previous && this.previous.length !== WIDTH * height) this.previous = null
    const mask = new Uint8Array(WIDTH * height)
    let count = 0
    let sumX = 0
    let changed = 0
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      const flame = isFlame(data[p], data[p + 1], data[p + 2]) ? 1 : 0
      mask[i] = flame
      if (flame) {
        count++
        sumX += i % WIDTH
      }
      if (this.previous && this.previous[i] !== flame) changed++
    }
    const flickering = this.previous !== null && count > 0 && changed / count >= FLICKER
    this.previous = mask

    const share = count / mask.length
    const looksLikeFlame = share >= (live ? MIN_SHARE : PHOTO_MIN_SHARE) && share <= MAX_SHARE
    if (live) {
      this.recent = [...this.recent, looksLikeFlame && flickering].slice(-WINDOW)
      if (this.recent.filter(Boolean).length < NEEDED) return null
    } else if (!looksLikeFlame) return null

    const cx = sumX / count / WIDTH
    const side: Side = cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : 'ahead'
    return { name: 'fire', side, size: share, near: share >= NEAR_SHARE, distance: null }
  }

  reset() {
    this.previous = null
    this.recent = []
  }
}
