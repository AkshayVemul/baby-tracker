import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { read } from '../lib/storage'
import { AUTH_STORAGE_KEY, supabase } from '../lib/supabase'

/** The session saved on this phone, even if its access token has expired; enough to open the app offline. */
function storedSession(): Session | null {
  const session = read<Session>(AUTH_STORAGE_KEY)
  return session?.user ? session : null
}

/**
 * The Supabase auth session: `undefined` while restoring it, `null` when signed out.
 * Offline, the stored session is used as-is: the auth client would otherwise spend up to 30 seconds retrying a
 * token refresh and then report no session. It refreshes the token by itself once the phone is back online.
 */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(() => (navigator.onLine ? undefined : storedSession()))
  useEffect(() => {
    // The first value comes from the initial state (offline) or getSession below; later events
    // (sign-in, sign-out, token refresh) arrive here.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== 'INITIAL_SESSION') setSession(next)
    })
    if (navigator.onLine) {
      supabase.auth.getSession().then(({ data: { session: current }, error }) => {
        setSession(current ?? (error && isAuthRetryableFetchError(error) ? storedSession() : null))
      })
    }
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
