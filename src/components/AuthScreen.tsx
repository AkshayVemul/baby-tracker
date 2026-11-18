import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/** Email + password sign-in. Works from a home-screen app, where email links would open another browser. */
export function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const credentials = { email: email.trim(), password }
    const { data, error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.href } })
    setBusy(false)
    if (error) return setError(error.message)
    if (mode === 'signUp' && !data.session) {
      setNotice('Check your inbox and open the confirmation link, then sign in here.')
      setMode('signIn')
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) return setError('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.href })
    if (error) return setError(error.message)
    setNotice('We sent a link to sign in. Then set a new password from Settings.')
  }

  return (
    <div className="app gate">
      <header className="gate-head">
        <span className="gate-logo" aria-hidden="true">🌙</span>
        <h1>Baby Tracker</h1>
        <p className="muted">Sleep, feeds, diapers and more — shared with everyone who looks after your baby.</p>
      </header>
      <form className="card form" onSubmit={submit}>
        <div className="segmented" role="group" aria-label="Account">
          <button type="button" className={mode === 'signIn' ? 'active' : undefined} aria-pressed={mode === 'signIn'} onClick={() => setMode('signIn')}>
            Sign in
          </button>
          <button type="button" className={mode === 'signUp' ? 'active' : undefined} aria-pressed={mode === 'signUp'} onClick={() => setMode('signUp')}>
            Create account
          </button>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="small" role="status">{notice}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'signIn' && (
          <button type="button" className="btn ghost small" onClick={resetPassword}>
            Forgot password?
          </button>
        )}
      </form>
    </div>
  )
}
