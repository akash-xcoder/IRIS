import { useEffect, useState } from 'react'
import { AuthForm } from '../family/AuthForm'
import { linkedFamily, supabase, useProfile, useSession, type Profile } from '../family/supabase'
import { say } from '../navigation/voice'

/** Spaced out so a screen reader or the speech voice reads it one character at a time. */
const spell = (code: string) => code.split('').join(' ')

/**
 * The IRIS user's account. Signed in, their falls and help requests reach every family member
 * who has linked with the code shown here.
 */
export function FamilyAccount() {
  const session = useSession()
  const profile = useProfile(session)
  const [family, setFamily] = useState<Profile[] | null>(null)

  const userId = profile?.role === 'user' ? profile.id : null
  useEffect(() => {
    if (!userId) return
    let stale = false
    linkedFamily(userId).then((f) => !stale && setFamily(f))
    return () => {
      stale = true
    }
  }, [userId])

  if (!supabase) return null

  return (
    <div className="field">
      <h2 className="field-label">Family alerts</h2>
      {session === undefined || (session && profile === undefined) ? (
        <p className="hint">Loading…</p>
      ) : !session ? (
        <>
          <p className="hint">Sign in so a fall or a call for help reaches your family’s dashboard.</p>
          <AuthForm role="user" idPrefix="iris-auth" />
        </>
      ) : !profile ? (
        <>
          <p className="hint">This account was made before family alerts existed. Sign out and create a new account.</p>
          <SignOut />
        </>
      ) : profile.role !== 'user' ? (
        <>
          <p className="hint">This is a family account. Open the family dashboard at {location.origin}/family.</p>
          <SignOut />
        </>
      ) : (
        <>
          <p className="hint">Signed in as {profile.full_name || session.user.email}.</p>
          {profile.link_code && (
            <div className="link-code">
              <span className="sos-muted">Family code</span>
              <strong aria-label={spell(profile.link_code)}>{profile.link_code}</strong>
              <button type="button" className="button" onClick={() => say(`Your family code is ${spell(profile.link_code!)}`)}>
                Read aloud
              </button>
            </div>
          )}
          <p className="hint">
            Family members sign in at {location.origin}/family and enter this code.{' '}
            {family === null
              ? ''
              : family.length
                ? `Alerts go to ${family.map((f) => f.full_name || 'a family member').join(', ')}.`
                : 'Nobody has linked yet.'}
          </p>
          <SignOut />
        </>
      )}
    </div>
  )
}

function SignOut() {
  return (
    <div className="actions">
      <button type="button" className="button" onClick={() => supabase?.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
