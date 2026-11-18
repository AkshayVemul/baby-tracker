import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** False until `.env.local` has the project URL and publishable key; the app then shows setup steps. */
export const isConfigured = Boolean(url && key)

/** Where supabase-js keeps the signed-in session; the same name it uses by default, spelled out so we can read it offline. */
export const AUTH_STORAGE_KEY = `sb-${url ? new URL(url).hostname.split('.')[0] : 'local'}-auth-token`

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_STORAGE_KEY },
})
