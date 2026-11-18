import { useEffect, useMemo, useState } from 'react'
import { ChartsView } from './components/ChartsView'
import { EntryForm } from './components/EntryForm'
import { HistoryView } from './components/HistoryView'
import { Icon, type IconName } from './components/Icon'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { useNow } from './hooks/useNow'
import {
  deleteAllEntries,
  deleteEntry,
  fetchEntries,
  fromRow,
  saveEntries,
  updateHousehold,
  type EntryRow,
  type Household,
} from './lib/db'
import { isRunning, newEntry } from './lib/entries'
import { loadSettings, newId, saveSettings } from './lib/storage'
import { supabase } from './lib/supabase'
import { formatAge } from './lib/time'
import type { Actions, Entry, Settings } from './types'

type Tab = 'today' | 'history' | 'charts' | 'settings'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'history', label: 'History', icon: 'list' },
  { id: 'charts', label: 'Charts', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

interface Toast {
  id: number
  message: string
  undo?: () => void
}

interface Props {
  household: Household
  email: string | undefined
  onHousehold: (household: Household) => void
}

/** Adds or replaces entries by id. */
function merge(prev: Entry[], incoming: Entry[]): Entry[] {
  const byId = new Map(prev.map((e) => [e.id, e]))
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()]
}

export default function App({ household, email, onHousehold }: Props) {
  const householdId = household.id
  // `null` until the first load from Supabase finishes.
  const [entries, setEntries] = useState<Entry[] | null>(null)
  // Units stay per device; the baby's name and birth date live on the shared household.
  const [units, setUnits] = useState(loadSettings)
  const [tab, setTab] = useState<Tab>('today')
  const [draft, setDraft] = useState<{ entry: Entry; isNew: boolean } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const list = entries ?? []
  // Tick every second while a timer runs; otherwise often enough for "5m ago" labels.
  const now = useNow(list.some(isRunning) ? 1000 : 30_000)

  const settings: Settings = { ...units, babyName: household.baby_name, birthDate: household.birth_date ?? '' }

  useEffect(() => saveSettings(units), [units])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  // Load everything, then stay in sync with the other members through Supabase Realtime.
  // Refetch when the app comes back to the foreground, in case the socket missed changes while asleep.
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchEntries(householdId)
        .then((loaded) => !cancelled && setEntries(loaded))
        .catch((e: Error) => !cancelled && setToast({ id: Date.now(), message: `Couldn’t load: ${e.message}` }))
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setEntries((prev) => prev && merge(prev, [fromRow(payload.new as EntryRow)]))
        },
      )
      // Deletes can't be filtered server-side; removing an id we don't have is a no-op.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'entries' }, (payload) => {
        const id = (payload.old as Partial<EntryRow>).id
        setEntries((prev) => prev && prev.filter((e) => e.id !== id))
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` },
        (payload) => onHousehold(payload.new as Household),
      )
      .subscribe()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [householdId, onHousehold])

  const actions = useMemo<Actions>(() => {
    // Changes show immediately; if Supabase rejects one, say so and reload the truth.
    const fail = (e: Error) => {
      setToast({ id: Date.now(), message: `Couldn’t sync: ${e.message}` })
      fetchEntries(householdId).then(setEntries).catch(() => {})
    }
    const save = (entry: Entry) => {
      setEntries((prev) => merge(prev ?? [], [entry]))
      saveEntries([entry], householdId).catch(fail)
    }
    const drop = (id: string) => {
      setEntries((prev) => prev && prev.filter((e) => e.id !== id))
      deleteEntry(id).catch(fail)
    }
    return {
      save,
      remove: (entry) => {
        drop(entry.id)
        setToast({ id: Date.now(), message: 'Entry deleted', undo: () => save(entry) })
      },
      log: (partial, message) => {
        const entry = { id: newId(), ...partial }
        save(entry)
        setToast({ id: Date.now(), message, undo: () => drop(entry.id) })
        return entry
      },
      edit: (entry) => setDraft({ entry, isNew: false }),
      create: (type, overrides) => setDraft({ entry: newEntry(type, Date.now(), overrides), isNew: true }),
    }
  }, [householdId])

  const changeSettings = (next: Settings) => {
    setUnits(next)
    const birthDate = next.birthDate || null
    if (next.babyName !== household.baby_name || birthDate !== household.birth_date) {
      onHousehold({ ...household, baby_name: next.babyName, birth_date: birthDate })
      updateHousehold(householdId, { baby_name: next.babyName, birth_date: birthDate }).catch((e: Error) =>
        setToast({ id: Date.now(), message: `Couldn’t save: ${e.message}` }),
      )
    }
  }

  /** Bulk changes from Settings: restore, sample data, delete all, upload this device's old entries. */
  const bulk = {
    replaceAll: async (next: Entry[]) => {
      setEntries(next)
      await deleteAllEntries(householdId)
      await saveEntries(next, householdId)
    },
    add: async (more: Entry[]) => {
      setEntries((prev) => merge(prev ?? [], more))
      await saveEntries(more, householdId)
    },
  }

  const age = formatAge(settings.birthDate, now)

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{settings.babyName ? `${settings.babyName}` : 'Baby Tracker'}</h1>
          {age ? <p className="muted">{age}</p> : <p className="muted">Sleep, feeds, diapers and more</p>}
        </div>
        <button className="btn primary" onClick={() => actions.create('feed')}>
          <Icon name="plus" /> Log
        </button>
      </header>

      <main className="content">
        {entries === null && tab !== 'settings' ? (
          <div className="card empty">
            <p className="muted">Loading entries…</p>
          </div>
        ) : (
          <>
            {tab === 'today' && <TodayView entries={list} settings={settings} now={now} actions={actions} />}
            {tab === 'history' && <HistoryView entries={list} settings={settings} now={now} actions={actions} />}
            {tab === 'charts' && <ChartsView entries={list} settings={settings} now={now} />}
          </>
        )}
        {tab === 'settings' && (
          <SettingsView
            entries={list}
            settings={settings}
            household={household}
            email={email}
            now={now}
            onSettings={changeSettings}
            bulk={bulk}
            onOpenToday={() => {
              setTab('today')
              window.scrollTo(0, 0)
            }}
          />
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => {
              setTab(t.id)
              window.scrollTo(0, 0)
            }}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {draft && (
        <EntryForm
          key={draft.entry.id}
          initial={draft.entry}
          isNew={draft.isNew}
          settings={settings}
          onClose={() => setDraft(null)}
          onSave={(entry) => {
            actions.save(entry)
            setDraft(null)
          }}
          onDelete={() => {
            actions.remove(draft.entry)
            setDraft(null)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="btn ghost small"
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
