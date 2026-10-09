/**
 * Auto-torch manager for IRIS navigation.
 * Uses MediaStreamTrack Image Capture / Torch constraints with downsampled canvas luminance detection.
 */

export interface TorchManager {
  supported: boolean
  isTorchOn: () => boolean
  setTorch: (on: boolean) => Promise<boolean>
  stop: () => void
}

/**
 * Checks if the video track supports hardware flashlight / torch.
 */
export function isTorchSupported(track: MediaStreamTrack | null | undefined): boolean {
  if (!track || track.kind !== 'video') return false
  if (typeof track.getCapabilities !== 'function') return false
  try {
    const caps = track.getCapabilities() as { torch?: boolean }
    return Boolean(caps && caps.torch)
  } catch {
    return false
  }
}

/**
 * Safely applies the torch constraint to a video track.
 */
export async function setTrackTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  if (!isTorchSupported(track)) return false
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as MediaTrackConstraintSet],
    })
    return true
  } catch (err) {
    console.warn('Could not set torch mode:', err)
    return false
  }
}

/**
 * Measures the average frame brightness (0–255) using a downsampled 32x32 offscreen canvas.
 * Applies ITU-R BT.601 standard luminance weighting: Y = 0.299*R + 0.587*G + 0.114*B.
 */
export function sampleFrameBrightness(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement,
): number | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    return null
  }

  const offscreen = canvas ?? document.createElement('canvas')
  offscreen.width = 32
  offscreen.height = 32
  const ctx = offscreen.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, 32, 32)
  const { data } = ctx.getImageData(0, 0, 32, 32)

  let totalLuminance = 0
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b
  }

  return totalLuminance / pixelCount
}

export interface AutoTorchOptions {
  /** Low-light threshold below which torch should turn on (0-255). Default: 36 */
  darkThreshold?: number
  /** Brightness threshold above which torch should turn off (0-255). Default: 90 */
  brightThreshold?: number
  /** Sampling interval in milliseconds. Default: 1500ms */
  sampleIntervalMs?: number
  /** Minimum duration in milliseconds torch stays on before it can auto-turn off to prevent strobe flickering. Default: 6000ms */
  cooldownMs?: number
  /** Callback fired when torch status changes */
  onChange?: (torchOn: boolean, brightness: number) => void
}

/**
 * Monitors ambient lighting on an active camera stream and automatically toggles the flashlight.
 */
export function startAutoTorch(
  video: HTMLVideoElement,
  track: MediaStreamTrack,
  options: AutoTorchOptions = {},
): TorchManager {
  const {
    darkThreshold = 36,
    brightThreshold = 90,
    sampleIntervalMs = 1500,
    cooldownMs = 6000,
    onChange,
  } = options

  const supported = isTorchSupported(track)
  let active = true
  let torchState = false
  let lastToggleTime = 0
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32

  async function apply(on: boolean, brightness: number) {
    if (!supported || !active || torchState === on) return
    const success = await setTrackTorch(track, on)
    if (success) {
      torchState = on
      lastToggleTime = performance.now()
      onChange?.(torchState, brightness)
    }
  }

  const intervalId = window.setInterval(async () => {
    if (!active || !supported) return

    const brightness = sampleFrameBrightness(video, canvas)
    if (brightness === null) return

    const now = performance.now()
    const elapsedSinceToggle = now - lastToggleTime

    if (!torchState && brightness < darkThreshold) {
      // Dark room detected: Turn ON flashlight
      await apply(true, brightness)
    } else if (torchState && brightness > brightThreshold && elapsedSinceToggle > cooldownMs) {
      // Ambient light restored and cooldown elapsed: Turn OFF flashlight
      await apply(false, brightness)
    }
  }, sampleIntervalMs)

  return {
    supported,
    isTorchOn: () => torchState,
    setTorch: async (on: boolean) => {
      if (!supported) return false
      const success = await setTrackTorch(track, on)
      if (success) {
        torchState = on
        lastToggleTime = performance.now()
        onChange?.(torchState, 0)
      }
      return success
    },
    stop: () => {
      active = false
      window.clearInterval(intervalId)
      if (torchState) {
        setTrackTorch(track, false).catch(() => {})
        torchState = false
      }
    },
  }
}
