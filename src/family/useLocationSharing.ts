import { useEffect, useState } from 'react'
import { FAMILY_CHANGED, loadFamily } from '../safety/family'
import { supabase, useProfile, useSession } from './supabase'

/** Don't send more often than this, however fast the position changes. */
const MIN_INTERVAL_MS = 15_000
/** Smaller moves than this are GPS jitter. */
const MIN_MOVE_M = 15
/** Re-send the same position this often, so the family can tell the app is still open. */
const HEARTBEAT_MS = 60_000

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.hypot(x, y) * 6_371_000
}

/**
 * While "Share live location with parents" is on and an IRIS user is signed in, keeps their
 * position on the family dashboard up to date. Turning it off removes the position.
 */
export function useLocationSharing() {
  const session = useSession()
  const profile = useProfile(session)
  const [on, setOn] = useState(() => loadFamily().shareLocation)

  useEffect(() => {
    const update = () => setOn(loadFamily().shareLocation)
    window.addEventListener(FAMILY_CHANGED, update)
    return () => window.removeEventListener(FAMILY_CHANGED, update)
  }, [])

  const userId = profile?.role === 'user' ? profile.id : null

  useEffect(() => {
    const db = supabase
    if (!db || !userId) return
    if (!on) {
      db.from('iris_locations').delete().eq('user_id', userId).then(() => {})
      return
    }
    if (!navigator.geolocation) return

    let latest: { lat: number; lng: number; accuracy: number } | null = null
    let sent: { lat: number; lng: number; at: number } | null = null

    const send = (force: boolean) => {
      if (!latest) return
      const now = Date.now()
      if (!force && sent && (now - sent.at < MIN_INTERVAL_MS || metersBetween(sent, latest) < MIN_MOVE_M)) return
      sent = { lat: latest.lat, lng: latest.lng, at: now }
      // user_id comes from the column default (auth.uid()), so an update only touches the position.
      db.from('iris_locations')
        .upsert({ latitude: latest.lat, longitude: latest.lng, accuracy_m: latest.accuracy })
        .then(({ error }) => error && console.warn('Live location not shared:', error.message))
    }

    const watch = navigator.geolocation.watchPosition(
      (p) => {
        latest = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
        send(false)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    const heartbeat = setInterval(() => send(true), HEARTBEAT_MS)
    return () => {
      navigator.geolocation.clearWatch(watch)
      clearInterval(heartbeat)
    }
  }, [on, userId])
}
