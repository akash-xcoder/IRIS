import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when the build has no Supabase settings: family features then stay hidden. */
export const supabase = url && key ? createClient(url, key) : null

export type Role = 'user' | 'family'

export interface Profile {
  id: string
  role: Role
  full_name: string
  link_code: string | null
}

export type AlertKind = 'fall' | 'help'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export interface Alert {
  id: string
  user_id: string
  kind: AlertKind
  status: AlertStatus
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  message: string
  created_at: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
}

/** The signed-in session; `undefined` until the stored one has been read. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

/** The profile of the signed-in account, re-read when the account changes. */
export function useProfile(session: Session | null | undefined): Profile | null | undefined {
  const userId = session?.user.id
  const [loaded, setLoaded] = useState<{ id: string; profile: Profile | null } | null>(null)
  useEffect(() => {
    if (!supabase || !userId) return
    let stale = false
    supabase
      .from('iris_profiles')
      .select('id, role, full_name, link_code')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => !stale && setLoaded({ id: userId, profile: data as Profile | null }))
    return () => {
      stale = true
    }
  }, [userId])
  if (session === undefined) return undefined
  if (!userId) return null
  return loaded?.id === userId ? loaded.profile : undefined
}

export interface Position {
  latitude: number
  longitude: number
  accuracy: number
}

export function currentPosition(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    )
  })
}

export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`

/**
 * Raises an alert for the signed-in IRIS user's family. Resolves to the alert's id, or to null
 * when nobody is signed in; rejects when the alert couldn't be saved.
 */
export async function raiseAlert(kind: AlertKind, position: Position | null, message: string): Promise<string | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return null
  const { data, error } = await supabase
    .from('iris_alerts')
    .insert({
      kind,
      message,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      accuracy_m: position?.accuracy ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

/** The family members linked to the signed-in IRIS user. */
export async function linkedFamily(userId: string): Promise<Profile[]> {
  if (!supabase) return []
  const { data: links } = await supabase.from('iris_family_links').select('family_id').eq('user_id', userId)
  const ids = (links ?? []).map((l) => l.family_id as string)
  if (!ids.length) return []
  const { data } = await supabase.from('iris_profiles').select('id, role, full_name, link_code').in('id', ids)
  return (data ?? []) as Profile[]
}

/** An IRIS user's latest position, while they share live location. */
export interface LiveLocation {
  user_id: string
  latitude: number
  longitude: number
  accuracy_m: number | null
  updated_at: string
}
