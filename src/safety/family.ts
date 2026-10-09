/**
 * Family features, remembered on this device. Live location and location with SOS reach the family
 * dashboard when signed in (Family alerts); trip and battery alerts are still a demo.
 */
export interface Family {
  shareLocation: boolean
  locationWithSos: boolean
  tripStarts: boolean
  lowBattery: boolean
}

const DEFAULTS: Family = { shareLocation: false, locationWithSos: true, tripStarts: false, lowBattery: true }
const KEY = 'yooolo.family'
/** Fired on window whenever the switches change, so live location sharing can start or stop. */
export const FAMILY_CHANGED = 'iris:family-changed'

export function loadFamily(): Family {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Family>) }
  } catch {
    return DEFAULTS
  }
}

export function saveFamily(family: Family) {
  try {
    localStorage.setItem(KEY, JSON.stringify(family))
  } catch {
    // Private windows and blocked storage: the switches just won't be remembered.
  }
  window.dispatchEvent(new Event(FAMILY_CHANGED))
}
