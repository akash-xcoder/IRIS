import { useEffect, useRef, useState } from 'react'
import type { Frame } from '../Viewport'
import { allHazards, buzz, HazardAnnouncer, hazardPhrase, isUrgent, type Hazard } from './hazards'
import { say, speaking } from './voice'

const KEY = 'iris.speakDangers'

function loadOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

/** Whether danger warnings are spoken on the camera screen, remembered on this device. */
export function useSpeakDangers(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(loadOn)
  const set = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // Not remembered in private windows.
    }
  }
  return [on, set]
}

interface Options {
  frame: Frame | null
  names: string[]
  stairClasses: readonly number[]
  surfaceNames: readonly string[]
  hazardNames: string[]
  /** Off while a trip or the home guide is open: they announce hazards themselves. */
  enabled: boolean
}

/**
 * Speaks the most pressing danger the camera sees (fire, a drop, a wall, stairs, an obstacle) and
 * buzzes, then waits before repeating it. Returns the current dangers, most pressing first.
 */
export function useDangerVoice({ frame, names, stairClasses, surfaceNames, hazardNames, enabled }: Options): Hazard[] {
  const announcer = useRef(new HazardAnnouncer())
  const hazards = frame
    ? allHazards({
        objects: frame.objects,
        names,
        surfaces: frame.surfaces,
        stairClasses,
        surfaceNames,
        detected: frame.hazards,
        detectedNames: hazardNames,
        fire: frame.fire,
      })
    : []

  useEffect(() => {
    if (!enabled || !frame) return
    const found = allHazards({
      objects: frame.objects,
      names,
      surfaces: frame.surfaces,
      stairClasses,
      surfaceNames,
      detected: frame.hazards,
      detectedNames: hazardNames,
      fire: frame.fire,
    })
    const h = announcer.current.pick(speaking() ? found.filter(isUrgent) : found)
    if (!h) return
    say(hazardPhrase(h))
    buzz(h)
  }, [frame, names, stairClasses, surfaceNames, hazardNames, enabled])

  return hazards
}
