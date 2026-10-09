/**
 * Rough distances from a single camera. Something resting on the ground appears lower in the frame
 * the closer it is; with the phone's height and tilt, that height in the frame gives a distance.
 *
 *            phone ── horizon
 *              │ ╲  angle below horizon = tilt + offset from frame centre
 *   height ~1.3 m   ╲
 *              │      ╲
 *   ───────────┴────────●── ground point, distance = height / tan(angle)
 */

/** Chest height, where a phone held out in front usually is. */
const CAMERA_HEIGHT_M = 1.3
/** Vertical field of view of a typical phone's main camera, held upright and sideways. */
const FOV_PORTRAIT = 64
const FOV_LANDSCAPE = 40
/** Used until the tilt sensor reports, or where there is none: people point a little down. */
const DEFAULT_TILT = 8
/** One walking step. */
export const STEP_M = 0.7

let tilt: number | null = null

/** How far below the horizon the back camera points, in degrees, from the phone's orientation. */
function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return
  const angle = screen.orientation?.angle ?? 0
  // Upright in portrait, beta is 90; laid flat (camera at the floor) it's 0. Sideways, gamma does the same.
  tilt = angle === 90 || angle === 270 ? 90 - Math.abs(e.gamma) : 90 - e.beta
}

if (typeof window !== 'undefined') window.addEventListener('deviceorientation', onOrientation)

export const cameraTilt = () => tilt ?? DEFAULT_TILT

/**
 * Metres to a point on the ground that appears `yFrac` of the way down a frame of the given
 * size, or null when that point is at or above the horizon (too far to tell).
 */
export function groundDistance(yFrac: number, width: number, height: number): number | null {
  const fov = height >= width ? FOV_PORTRAIT : FOV_LANDSCAPE
  const below = cameraTilt() + (yFrac - 0.5) * fov
  if (below < 3) return null
  return Math.min(20, Math.max(0.3, CAMERA_HEIGHT_M / Math.tan((below * Math.PI) / 180)))
}

/** "about 3 steps", or "right in front of you" when it's within reach. */
export function distancePhrase(meters: number): string {
  if (meters < 0.8) return 'right in front of you'
  const steps = Math.max(2, Math.round(meters / STEP_M))
  return steps > 12 ? `about ${Math.round(meters)} metres away` : `about ${steps} steps away`
}
