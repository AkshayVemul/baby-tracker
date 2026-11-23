import { useCallback, useEffect, useRef, useState } from 'react'
import { DbError, deleteAllEntries, fetchEntries, fetchMyHousehold, fromRow, saveEntries, sendOp, type EntryRow, type Household } from '../lib/db'
import { applyOutbox, clearOutbox, enqueue, flush, hasPending, isRetryable, loadOutbox } from '../lib/outbox'
import { loadCachedEntries, saveCachedEntries } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Entry } from '../types'

/** Adds or replaces entries by id. */
function merge(prev: Entry[], incoming: Entry[]): Entry[] {
  const byId = new Map(prev.map((e) => [e.id, e]))
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()]
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

const RETRY_MS = 30_000
const CATCH_UP_GAP_MS = 5_000

/**
 * The household's entries, offline-first. The app starts from this phone's cached copy, every change is
 * shown at once and queued in the outbox, and the queue is sent whenever Supabase is reachable: right away,
 * when the phone comes back online or to the foreground, and every 30 seconds while anything is waiting.
 * Changes from other members arrive through Supabase Realtime.
 */
export function useEntries(
  householdId: string,
  onHousehold: (household: Household) => void,
  notify: (message: string) => void,
) {
  // `null` only on a phone that has never loaded this household.
  const [entries, setEntries] = useState<Entry[] | null>(() => {
    const cached = loadCachedEntries(householdId)
    return cached && applyOutbox(cached, loadOutbox(householdId))
  })
  const [pending, setPending] = useState(() => loadOutbox(householdId).length)
  const online = useOnline()
  const flushing = useRef(false)
  // Bumped by a manual refresh to reconnect the Realtime channel, which can drop without saying so.
  const [connection, setConnection] = useState(0)

  useEffect(() => {
    if (entries) saveCachedEntries(householdId, entries)
  }, [entries, householdId])

  /** Fetches the entries; false when they couldn't be loaded. */
  const load = useCallback(async () => {
    try {
      const loaded = await fetchEntries(householdId)
      setEntries(applyOutbox(loaded, loadOutbox(householdId)))
      return true
    } catch (e) {
      // Offline: keep showing the cached copy. Only a real server error is worth a message.
      if (!(e instanceof DbError && isRetryable(e.status))) notify(`Couldn’t load: ${(e as Error).message}`)
      return false
    }
  }, [householdId, notify])

  const sync = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      // Loop so changes queued while a flush was running go out too; stops when empty or unreachable.
      for (;;) {
        const { offline, rejected } = await flush(householdId, (op) => sendOp(op, householdId))
        if (rejected.length > 0) {
          notify(`Couldn’t save ${rejected.length === 1 ? 'a change' : `${rejected.length} changes`}: ${rejected[0].message}`)
          await load()
        }
        if (offline || loadOutbox(householdId).length === 0) break
      }
    } finally {
      flushing.current = false
      setPending(loadOutbox(householdId).length)
    }
  }, [householdId, load, notify])

  /**
   * Catches up, for when live updates stopped arriving: sends what's queued, reloads the entries and the household,
   * and reconnects Realtime. Runs from the refresh button and whenever the app comes back into view. False when the
   * entries couldn't be loaded (e.g. offline).
   */
  const refresh = useCallback(async () => {
    setConnection((n) => n + 1)
    await sync()
    const loaded = await load()
    const household = await fetchMyHousehold().catch(() => null)
    if (household?.id === householdId) onHousehold(household)
    return loaded
  }, [householdId, load, onHousehold, sync])

  useEffect(() => {
    const start = () => sync().then(load)
    start()
    // Coming back to the app (another tab or app, the phone unlocked) or back online. Switching apps fires both
    // focus and visibilitychange, so one refresh covers a few seconds.
    let last = Date.now()
    const catchUp = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < CATCH_UP_GAP_MS) return
      last = Date.now()
      refresh()
    }
    document.addEventListener('visibilitychange', catchUp)
    window.addEventListener('focus', catchUp)
    window.addEventListener('online', catchUp)
    const retry = setInterval(() => {
      if (loadOutbox(householdId).length > 0) sync()
    }, RETRY_MS)
    return () => {
      document.removeEventListener('visibilitychange', catchUp)
      window.removeEventListener('focus', catchUp)
      window.removeEventListener('online', catchUp)
      clearInterval(retry)
    }
  }, [householdId, load, refresh, sync])

  useEffect(() => {
    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const entry = fromRow(payload.new as EntryRow)
          // A change still queued on this phone is newer than what the server just echoed.
          if (hasPending(householdId, entry.id)) return
          setEntries((prev) => prev && merge(prev, [entry]))
        },
      )
      // Deletes can't be filtered server-side; removing an id we don't have is a no-op.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'entries' }, (payload) => {
        const id = (payload.old as Partial<EntryRow>).id
        if (id && hasPending(householdId, id)) return
        setEntries((prev) => prev && prev.filter((e) => e.id !== id))
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` },
        (payload) => onHousehold(payload.new as Household),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, onHousehold, connection])

  const save = useCallback(
    (entry: Entry) => {
      setEntries((prev) => merge(prev ?? [], [entry]))
      enqueue(householdId, { type: 'upsert', entry })
      setPending(loadOutbox(householdId).length)
      sync()
    },
    [householdId, sync],
  )

  const drop = useCallback(
    (id: string) => {
      setEntries((prev) => prev && prev.filter((e) => e.id !== id))
      enqueue(householdId, { type: 'delete', id })
      setPending(loadOutbox(householdId).length)
      sync()
    },
    [householdId, sync],
  )

  /** Restore, sample data and delete-all replace everything, so they need a connection. */
  const replaceAll = async (next: Entry[]) => {
    clearOutbox(householdId)
    setPending(0)
    setEntries(next)
    await deleteAllEntries(householdId)
    await saveEntries(next, householdId)
  }

  const add = async (more: Entry[]) => {
    setEntries((prev) => merge(prev ?? [], more))
    await saveEntries(more, householdId)
  }

  return { entries, pending, online, save, drop, replaceAll, add, refresh }
}
