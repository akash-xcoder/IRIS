import { useState, type FormEvent } from 'react'
import { supabase, type Role } from './supabase'

/** Email and password sign-in, or sign-up as the given role. */
export function AuthForm({ role, idPrefix }: { role: Role; idPrefix: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { role, full_name: name.trim() }, emailRedirectTo: location.href },
          })
    setBusy(false)
    if (error) return setMessage({ text: error.message, error: true })
    if (mode === 'signup' && !data.session) {
      setMessage({ text: `Check ${email} for a link to confirm the account, then sign in.` })
      setMode('signin')
    }
  }

  const id = (s: string) => `${idPrefix}-${s}`

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="segmented auth-modes" role="tablist">
        {(['signin', 'signup'] as const).map((m) => (
          <label key={m}>
            <input type="radio" name={id('mode')} checked={mode === m} onChange={() => setMode(m)} />
            <span>{m === 'signin' ? 'Sign in' : 'Create account'}</span>
          </label>
        ))}
      </div>
      {mode === 'signup' && (
        <label className="auth-field" htmlFor={id('name')}>
          <span>Your name</span>
          <input id={id('name')} autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="auth-field" htmlFor={id('email')}>
        <span>Email</span>
        <input id={id('email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="auth-field" htmlFor={id('password')}>
        <span>Password</span>
        <input
          id={id('password')}
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      {message && (
        <p className={message.error ? 'notice' : 'hint'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </form>
  )
}
