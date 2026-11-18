import { useState, type FormEvent } from 'react'
import { createHousehold, joinHousehold, type Household } from '../lib/db'
import { loadSettings } from '../lib/storage'
import { supabase } from '../lib/supabase'

interface Props {
  email: string | undefined
  onReady: (household: Household) => void
}

/** First run after sign-in: start a household for the baby, or join a partner's with their code. */
export function HouseholdSetup({ email, onReady }: Props) {
  // Prefill from the profile saved before the app moved to Supabase.
  const local = loadSettings()
  const [babyName, setBabyName] = useState(local.babyName)
  const [birthDate, setBirthDate] = useState(local.birthDate)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (event: FormEvent, action: () => Promise<Household>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onReady(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="app gate">
      <header className="gate-head">
        <span className="gate-logo" aria-hidden="true">👶</span>
        <h1>Set up your household</h1>
        <p className="muted">Signed in as {email}</p>
      </header>

      <form className="card form" onSubmit={(e) => run(e, () => createHousehold(babyName.trim(), birthDate))}>
        <h3>New household</h3>
        <div className="grid-2">
          <label className="field">
            <span>Baby’s name</span>
            <input value={babyName} onChange={(e) => setBabyName(e.target.value)} />
          </label>
          <label className="field">
            <span>Birth date</span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
        </div>
        <button className="btn primary block" disabled={busy}>
          Create household
        </button>
      </form>

      <form className="card form" onSubmit={(e) => run(e, () => joinHousehold(code))}>
        <h3>Join with an invite code</h3>
        <p className="muted small">Your partner finds the code in Settings once they’ve set up.</p>
        <label className="field">
          <span>Invite code</span>
          <input value={code} required autoCapitalize="characters" placeholder="e.g. 7F3A9C21" onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className="btn block" disabled={busy}>
          Join household
        </button>
      </form>

      {error && <p className="error center" role="alert">{error}</p>}
      <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
