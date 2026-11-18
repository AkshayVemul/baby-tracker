import { useCallback, useEffect, useRef, useState } from 'react'
import { DbError, deleteAllEntries, fetchEntries, fromRow, saveEntries, sendOp, type EntryRow, type Household } from '../lib/db'
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

  useEffect(() => {
    if (entries) saveCachedEntries(householdId, entries)
  }, [entries, householdId])

  const load = useCallback(async () => {
    try {
      const loaded = await fetchEntries(householdId)
      setEntries(applyOutbox(loaded, loadOutbox(householdId)))
    } catch (e) {
      // Offline: keep showing the cached copy. Only a real server error is worth a message.
      if (!(e instanceof DbError && isRetryable(e.status))) notify(`Couldn’t load: ${(e as Error).message}`)
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

  useEffect(() => {
    const catchUp = () => sync().then(load)
    catchUp()
    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', catchUp)
    const retry = setInterval(() => {
      if (loadOutbox(householdId).length > 0) sync()
    }, RETRY_MS)

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
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', catchUp)
      clearInterval(retry)
      supabase.removeChannel(channel)
    }
  }, [householdId, onHousehold, load, sync])

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

  return { entries, pending, online, save, drop, replaceAll, add }
}
