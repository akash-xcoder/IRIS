import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { applyTheme, currentTheme, type Theme } from '../theme'
import { AuthForm } from './AuthForm'
import { LiveMap, type MapPoint } from './LiveMap'
import { mapLink, supabase, useProfile, useSession, type Alert, type AlertStatus, type LiveLocation, type Profile } from './supabase'

const HISTORY = 50
/** A fallback in case the live connection drops without telling us. */
const POLL_MS = 30_000

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleString()
}

const KIND_LABEL = { fall: 'Fall detected', help: 'Asked for help' } as const
const STATUS_LABEL: Record<AlertStatus, string> = { active: 'Needs help', acknowledged: 'Help on the way', resolved: 'Resolved' }

/** A repeating two-tone alarm, played while an alert is waiting for someone to respond. */
function useAlarm(on: boolean, ctx: AudioContext | null) {
  useEffect(() => {
    if (!on || !ctx) return
    const beep = () => {
      for (const [i, freq] of [880, 660].entries()) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const t = ctx.currentTime + i * 0.25
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.25)
      }
    }
    beep()
    const id = setInterval(beep, 1500)
    return () => clearInterval(id)
  }, [on, ctx])
}

export function FamilyDashboard() {
  const session = useSession()
  const profile = useProfile(session)
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  useEffect(() => {
    document.title = 'IRIS Family'
  }, [])

  return (
    <div className="family-page">
      <header className="masthead family-masthead">
        <h1 className="wordmark">
          IRIS <span className="family-wordmark">Family</span>
        </h1>
        <p className="tagline">Alerts from the people you look after.</p>
        <div className="family-head-tools">
          <button type="button" className="button" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {session && (
            <button type="button" className="button" onClick={() => supabase?.auth.signOut()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="family-main">
        {!supabase ? (
          <p className="notice">This build has no Supabase settings (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).</p>
        ) : session === undefined || (session && profile === undefined) ? (
          <p className="hint">Loading…</p>
        ) : !session ? (
          <section className="family-card family-auth">
            <h2 className="family-h2">Family sign in</h2>
            <p className="hint">
              Create a family account, then enter the code shown in the IRIS app under Parental settings → Family alerts.
            </p>
            <AuthForm role="family" idPrefix="family-auth" />
          </section>
        ) : profile?.role !== 'family' ? (
          <section className="family-card">
            <h2 className="family-h2">{profile ? 'This is an IRIS user account' : 'This account has no IRIS profile'}</h2>
            <p className="hint">
              {profile
                ? 'The dashboard is for family members. Sign out and create a family account with a different email.'
                : 'It was made before family alerts existed. Sign out and create a new family account.'}
            </p>
          </section>
        ) : (
          <Dashboard me={profile} />
        )}
      </main>
    </div>
  )
}

function Dashboard({ me }: { me: Profile }) {
  const [people, setPeople] = useState<Profile[] | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [locations, setLocations] = useState<LiveLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [audio, setAudio] = useState<AudioContext | null>(null)
  const [notify, setNotify] = useState(() => 'Notification' in window && Notification.permission === 'granted')
  const seen = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data: links, error: linkError } = await supabase.from('iris_family_links').select('user_id').eq('family_id', me.id)
    if (linkError) return setError(linkError.message)
    const ids = (links ?? []).map((l) => l.user_id as string)
    if (!ids.length) {
      setPeople([])
      setAlerts([])
      setLocations([])
      return
    }
    const [{ data: profiles }, { data: rows, error: alertError }, { data: places }] = await Promise.all([
      supabase.from('iris_profiles').select('id, role, full_name, link_code').in('id', ids),
      supabase.from('iris_alerts').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(HISTORY),
      supabase.from('iris_locations').select('*').in('user_id', ids),
    ])
    if (alertError) return setError(alertError.message)
    setError(null)
    setPeople((profiles ?? []) as Profile[])
    setAlerts((rows ?? []) as Alert[])
    setLocations((places ?? []) as LiveLocation[])
  }, [me.id])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
    const poll = setInterval(refresh, POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    // RLS decides which alerts and locations reach this account; any change re-reads them.
    const channel = supabase
      ?.channel('family-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iris_alerts' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iris_locations' }, () => refresh())
      .subscribe()
    return () => {
      clearInterval(poll)
      clearInterval(tick)
      if (channel) supabase?.removeChannel(channel)
    }
  }, [refresh])

  const nameOf = useCallback(
    (id: string) => people?.find((p) => p.id === id)?.full_name || 'Your family member',
    [people],
  )

  // A system notification for each new alert, once the first load has set the baseline.
  useEffect(() => {
    const active = alerts.filter((a) => a.status === 'active')
    if (seen.current === null) {
      seen.current = new Set(alerts.map((a) => a.id))
      return
    }
    for (const a of active) {
      if (seen.current.has(a.id)) continue
      seen.current.add(a.id)
      if (notify) {
        try {
          new Notification(`${nameOf(a.user_id)}: ${KIND_LABEL[a.kind]}`, { body: a.message, tag: a.id, requireInteraction: true })
        } catch {
          // Some mobile browsers only notify through a service worker; the alarm and the page still show it.
        }
      }
    }
  }, [alerts, notify, nameOf])

  const waiting = alerts.some((a) => a.status === 'active')
  useAlarm(waiting, audio)

  useEffect(() => {
    document.title = waiting ? '🔴 Help needed · IRIS Family' : 'IRIS Family'
  }, [waiting])

  async function enableAlerts() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx && !audio) {
      const ctx = new Ctx()
      await ctx.resume()
      setAudio(ctx)
    }
    if ('Notification' in window) setNotify((await Notification.requestPermission()) === 'granted')
  }

  async function respond(alert: Alert, status: AlertStatus) {
    if (!supabase) return
    const { error } = await supabase.from('iris_alerts').update({ status }).eq('id', alert.id)
    if (error) setError(error.message)
    refresh()
  }

  async function unlink(person: Profile) {
    if (!supabase) return
    await supabase.from('iris_family_links').delete().eq('user_id', person.id).eq('family_id', me.id)
    refresh()
  }

  const open = alerts.filter((a) => a.status !== 'resolved')
  const history = alerts.filter((a) => a.status === 'resolved')

  /** Each person's live location, or else where their latest alert came from. */
  const whereIs = (id: string) => {
    const live = locations.find((l) => l.user_id === id)
    if (live) return { lat: live.latitude, lng: live.longitude, accuracy: live.accuracy_m, at: live.updated_at, live: true }
    const fromAlert = alerts.find((a) => a.user_id === id && a.latitude != null && a.longitude != null)
    if (fromAlert) return { lat: fromAlert.latitude!, lng: fromAlert.longitude!, accuracy: fromAlert.accuracy_m, at: fromAlert.created_at, live: false }
    return null
  }
  const points: MapPoint[] = (people ?? []).flatMap((p) => {
    const at = whereIs(p.id)
    if (!at) return []
    const alert = open.some((a) => a.user_id === p.id)
    return [{ id: p.id, name: p.full_name || 'IRIS user', lat: at.lat, lng: at.lng, accuracy: at.accuracy, alert }]
  })

  return (
    <>
      <p className="hint">Signed in as {me.full_name || 'family member'}.</p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {(!audio || !notify) && (
        <div className="family-banner">
          <span>Turn on the alarm sound{'Notification' in window ? ' and notifications' : ''} so you hear an alert while this page is open.</span>
          <button type="button" className="button primary" onClick={enableAlerts}>
            Turn on alerts
          </button>
        </div>
      )}

      <section aria-labelledby="open-title" className="family-section">
        <h2 id="open-title" className="family-h2">
          {open.length ? 'Needs attention' : 'All clear'}
        </h2>
        {open.length === 0 ? (
          <p className="hint">{people?.length ? 'No open alerts. You’ll hear an alarm here the moment one comes in.' : ''}</p>
        ) : (
          <ul className="alert-list" aria-live="assertive">
            {open.map((a) => (
              <li key={a.id} className="alert-card" data-status={a.status}>
                <div className="alert-top">
                  <span className="alert-status">{STATUS_LABEL[a.status]}</span>
                  <time dateTime={a.created_at}>{timeAgo(a.created_at, now)}</time>
                </div>
                <h3 className="alert-title">
                  {nameOf(a.user_id)} · {KIND_LABEL[a.kind]}
                </h3>
                <p className="alert-message">{a.message}</p>
                <div className="actions">
                  {a.latitude != null && a.longitude != null && (
                    <a className="button" href={mapLink(a.latitude, a.longitude)} target="_blank" rel="noreferrer">
                      Open location{a.accuracy_m ? ` (±${Math.round(a.accuracy_m)} m)` : ''}
                    </a>
                  )}
                  {a.status === 'active' && (
                    <button type="button" className="button primary" onClick={() => respond(a, 'acknowledged')}>
                      I’m on my way
                    </button>
                  )}
                  <button type="button" className="button" onClick={() => respond(a, 'resolved')}>
                    Mark resolved
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {points.length > 0 && (
        <section aria-labelledby="map-title" className="family-section">
          <h2 id="map-title" className="family-h2">
            Where they are
          </h2>
          <LiveMap points={points} />
        </section>
      )}

      <section aria-labelledby="people-title" className="family-section">
        <h2 id="people-title" className="family-h2">
          People you look after
        </h2>
        {people === null ? (
          <p className="hint">Loading…</p>
        ) : (
          <ul className="people-list">
            {people.map((p) => {
              const latest = alerts.find((a) => a.user_id === p.id)
              const status = latest && latest.status !== 'resolved' ? STATUS_LABEL[latest.status] : 'Safe'
              const at = whereIs(p.id)
              return (
                <li key={p.id} className="family-card person">
                  <div>
                    <strong>{p.full_name || 'IRIS user'}</strong>
                    <p className="hint">{latest ? `Last alert ${timeAgo(latest.created_at, now)}` : 'No alerts yet'}</p>
                    <p className="hint">
                      {at ? (
                        <>
                          {at.live ? 'Live location' : 'Location from their last alert'}, {timeAgo(at.at, now)}
                          {at.accuracy ? ` (±${Math.round(at.accuracy)} m)` : ''} ·{' '}
                          <a href={mapLink(at.lat, at.lng)} target="_blank" rel="noreferrer">
                            Open in Maps
                          </a>
                        </>
                      ) : (
                        'Not sharing location. They can turn it on in the IRIS app’s Parental settings.'
                      )}
                    </p>
                  </div>
                  <span className="person-status" data-status={latest && latest.status !== 'resolved' ? latest.status : 'safe'}>
                    {status}
                  </span>
                  <button type="button" className="button person-unlink" onClick={() => unlink(p)}>
                    Unlink
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <LinkForm onLinked={refresh} />
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-title" className="family-section">
          <h2 id="history-title" className="family-h2">
            History
          </h2>
          <ul className="history-list">
            {history.map((a) => (
              <li key={a.id}>
                <span>
                  {nameOf(a.user_id)} · {KIND_LABEL[a.kind]}
                </span>
                <time className="hint" dateTime={a.created_at}>
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function LinkForm({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.rpc('iris_link_family', { code })
    setBusy(false)
    if (error) return setMessage({ text: error.message, error: true })
    setCode('')
    setMessage({ text: 'Linked. Their alerts will show up here.' })
    onLinked()
  }

  return (
    <form className="family-card link-form" onSubmit={submit}>
      <label htmlFor="link-code" className="field-label">
        Add someone with their family code
      </label>
      <div className="link-row">
        <input
          id="link-code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          placeholder="ABC234"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? 'Linking…' : 'Link'}
        </button>
      </div>
      <p className="hint">In the IRIS app: Parental settings → Family alerts. They sign in there and see the code.</p>
      {message && (
        <p className={message.error ? 'notice' : 'hint'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </form>
  )
}
