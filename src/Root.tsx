import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { AuthScreen } from './components/AuthScreen'
import { HouseholdSetup } from './components/HouseholdSetup'
import { useSession } from './hooks/useSession'
import { fetchMyHousehold, type Household } from './lib/db'
import { isConfigured } from './lib/supabase'

/** Decides what to show: setup steps, sign-in, household setup, or the tracker. */
export default function Root() {
  const session = useSession()
  const userId = session?.user.id
  // Tagged with the user it was loaded for, so signing in as someone else shows "Loading…" until theirs arrives.
  // `value: null` means this user isn't in a household yet.
  const [household, setHousehold] = useState<{ userId: string; value: Household | null } | null>(null)
  const [error, setError] = useState('')
  const changeHousehold = useCallback(
    (value: Household) => setHousehold((prev) => prev && { userId: prev.userId, value }),
    [],
  )

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchMyHousehold()
      .then((value) => !cancelled && setHousehold({ userId, value }))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!isConfigured) return <SetupNeeded />
  if (error) return <Message title="Couldn’t reach the database" detail={error} />
  if (session === undefined) return <Message title="Loading…" />
  if (session === null) return <AuthScreen />
  if (!household || household.userId !== userId) return <Message title="Loading…" />
  if (!household.value) {
    return <HouseholdSetup email={session.user.email} onReady={changeHousehold} />
  }
  return <App household={household.value} email={session.user.email} onHousehold={changeHousehold} />
}

function Message({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="app gate">
      <div className="card empty">
        <p>{title}</p>
        {detail && <p className="muted small">{detail}</p>}
      </div>
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="app gate">
      <div className="card form">
        <h2>Connect Supabase</h2>
        <ol className="steps">
          <li>
            Run <code>supabase/migrations/0001_init.sql</code> in your project’s SQL editor.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in the project URL and publishable key.
          </li>
          <li>Restart <code>pnpm dev</code>.</li>
        </ol>
      </div>
    </div>
  )
}
