import { useEffect, useRef, useState } from 'react'
import { useVoiceReply } from '../navigation/useVoiceReply'
import { canListen, say, sosReply } from '../navigation/voice'
import { currentPosition, linkedFamily, mapLink, raiseAlert, supabase, type AlertKind, type Position } from '../family/supabase'
import { loadContacts } from './contacts'
import { loadFamily } from './family'

/** Long enough to hear the question and answer it out loud. A call for help was asked for, so it waits less. */
const COUNTDOWN_S: Record<AlertKind, number> = { fall: 15, help: 6 }
/** Start listening by now even if the browser never reports the question finished. */
const PROMPT_MAX_MS = 8000

interface Recipient {
  name: string
  detail: string
  status: string
}

/** The phone numbers from Parental settings. Texting them is a demo: nothing is actually sent. */
function phoneRecipients(): Recipient[] {
  const { mom, dad } = loadContacts()
  return [
    { name: 'Mom', detail: mom || 'No number set', status: 'Demo' },
    { name: 'Dad', detail: dad || 'No number set', status: 'Demo' },
    { name: 'Ambulance', detail: '108', status: 'Demo' },
  ]
}

interface Sent {
  alertId: string | null
  recipients: Recipient[]
  error?: string
}

type Phase = { kind: 'countdown'; left: number } | { kind: 'sending' } | ({ kind: 'sent'; message: string } & Sent)

/** Sends the alert to the family dashboard when the user is signed in, and says who it reached. */
async function send(kind: AlertKind, message: string, position: Position | null): Promise<Sent> {
  const phones = phoneRecipients()
  try {
    const alertId = await raiseAlert(kind, position, message)
    if (!alertId || !supabase) return { alertId, recipients: phones }
    const { data } = await supabase.auth.getSession()
    const family = data.session ? await linkedFamily(data.session.user.id) : []
    const dashboard = family.length
      ? family.map((f) => ({ name: f.full_name || 'Family member', detail: 'Family dashboard', status: 'Sent' }))
      : [{ name: 'Family dashboard', detail: 'Nobody has linked yet', status: 'Saved' }]
    return { alertId, recipients: [...dashboard, ...phones] }
  } catch (err) {
    return { alertId: null, recipients: phones, error: (err as Error).message }
  }
}

const COPY: Record<AlertKind, { title: string; question: string; message: string }> = {
  fall: {
    title: 'Fall detected. Are you OK?',
    question: 'Fall detected. Are you okay? Say send to call for help, or say I am okay to cancel.',
    message: 'I may have fallen and need help.',
  },
  help: {
    title: 'Call your family for help?',
    question: 'Calling your family for help. Say send to send it now, or say cancel to stop.',
    message: 'I need help.',
  },
}

/**
 * Asks whether the user is OK after a fall (or confirms a call for help), and sends an SOS to the
 * family dashboard if they don't answer.
 */
export function FallAlert({ onClose, kind = 'fall' }: { onClose: () => void; kind?: AlertKind }) {
  const copy = COPY[kind]
  const [phase, setPhase] = useState<Phase>({ kind: 'countdown', left: COUNTDOWN_S[kind] })
  const okButton = useRef<HTMLButtonElement>(null)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    okButton.current?.focus()
    navigator.vibrate?.([400, 200, 400, 200, 400])
    // Listening starts after the question, so the microphone doesn't hear the phone talking.
    const fallback = setTimeout(() => setAsked(true), PROMPT_MAX_MS)
    say(copy.question, () => {
      clearTimeout(fallback)
      setAsked(true)
    })
    return () => clearTimeout(fallback)
  }, [copy])

  const counting = phase.kind === 'countdown'

  // Listen for "send" or "don't send" until the countdown ends.
  const { heard, blocked: micBlocked } = useVoiceReply(counting && asked, (text) => {
    const reply = sosReply(text)
    if (reply === 'cancel') {
      say('Okay. Glad you are safe.')
      onClose()
    } else if (reply === 'send') setPhase({ kind: 'sending' })
    return reply !== null
  })

  useEffect(() => {
    if (!counting) return
    const id = setInterval(
      () => setPhase((p) => (p.kind === 'countdown' ? (p.left <= 1 ? { kind: 'sending' } : { kind: 'countdown', left: p.left - 1 }) : p)),
      1000,
    )
    return () => clearInterval(id)
  }, [counting])

  // Send once the countdown runs out or the user asks for help.
  const sending = phase.kind === 'sending'
  useEffect(() => {
    if (!sending) return
    let stale = false
    // "Send location with SOS" can be turned off in Parental settings.
    ;(loadFamily().locationWithSos ? currentPosition() : Promise.resolve(null)).then(async (position) => {
      if (stale) return
      const location = position ? ` My location: ${mapLink(position.latitude, position.longitude)}` : ''
      const message = `SOS from IRIS: ${copy.message}${location}`
      const result = await send(kind, message, position)
      if (stale) return
      setPhase({ kind: 'sent', message, ...result })
      say(
        result.error
          ? 'The S O S could not reach your family. Check your internet connection.'
          : result.alertId
            ? 'S O S sent to your family. They can see where you are.'
            : 'S O S shown. Sign in under parental settings so your family gets these alerts.',
      )
    })
    return () => {
      stale = true
    }
  }, [sending, kind, copy])

  function cancel() {
    say('Okay. Glad you are safe.')
    onClose()
  }

  /** After the SOS went out: tell the family it's over. */
  function safeNow(alertId: string) {
    supabase
      ?.from('iris_alerts')
      .update({ status: 'resolved' })
      .eq('id', alertId)
      .then(() => {})
    say('Okay. Your family will see that you are safe.')
    onClose()
  }

  return (
    <div className="sos-backdrop">
      <div className="sos" role="alertdialog" aria-modal="true" aria-labelledby="sos-title" aria-describedby="sos-body">
        {phase.kind === 'sent' ? (
          <>
            <p className="sos-badge" data-sent="">
              ✓
            </p>
            <h2 id="sos-title" className="sos-title">
              SOS sent
            </h2>
            <div id="sos-body">
              <ul className="sos-contacts">
                {phase.recipients.map((c) => (
                  <li key={c.name + c.detail}>
                    <span>{c.name}</span>
                    <span className="sos-muted">{c.detail}</span>
                    <span className="sos-status" data-demo={c.status === 'Sent' ? undefined : ''}>
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="sos-message">{phase.message}</p>
              {phase.error ? (
                <p className="notice" role="alert">
                  Couldn’t reach the family dashboard: {phase.error}
                </p>
              ) : (
                !phase.alertId && <p className="sos-muted">Sign in under Parental settings to send this to your family’s dashboard.</p>
              )}
            </div>
            <div className="sos-actions">
              {phase.alertId && (
                <button type="button" className="button sos-primary" onClick={() => safeNow(phase.alertId!)}>
                  I’m safe now
                </button>
              )}
              <button type="button" className={phase.alertId ? 'button' : 'button sos-primary'} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sos-badge" aria-hidden="true">
              {phase.kind === 'countdown' ? phase.left : '…'}
            </p>
            <h2 id="sos-title" className="sos-title">
              {copy.title}
            </h2>
            <p id="sos-body" className="sos-muted">
              {phase.kind === 'countdown'
                ? `Sending an SOS to your family in ${phase.left} second${phase.left === 1 ? '' : 's'}.`
                : 'Sending an SOS with your location…'}
            </p>
            <div className="sos-actions">
              <button ref={okButton} type="button" className="button sos-primary" onClick={cancel}>
                {kind === 'fall' ? 'I’m OK' : 'Cancel'}
              </button>
              <button
                type="button"
                className="button sos-danger"
                disabled={phase.kind === 'sending'}
                onClick={() => setPhase({ kind: 'sending' })}
              >
                Send SOS now
              </button>
            </div>
            {phase.kind === 'countdown' && (
              <p className="sos-listen" aria-live="polite">
                {!canListen || micBlocked
                  ? 'Voice replies aren’t available here. Tap a button.'
                  : !asked
                    ? 'Asking…'
                    : heard
                      ? `Heard: “${heard}”`
                      : 'Listening… say “send” or “I’m OK”.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
