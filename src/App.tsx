import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartsView } from './components/ChartsView'
import { EntryForm } from './components/EntryForm'
import { HistoryView } from './components/HistoryView'
import { Icon, type IconName } from './components/Icon'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { useBackToClose, useHashRoute } from './hooks/useHashRoute'
import { useEntries } from './hooks/useEntries'
import { useNow } from './hooks/useNow'
import { updateHousehold, type Household, type HouseholdChanges } from './lib/db'
import { isRunning, newEntry } from './lib/entries'
import { loadSettings, newId, saveSettings } from './lib/storage'
import { applyTheme, followSystemTheme } from './lib/theme'
import { formatAge } from './lib/time'
import type { Actions, Entry, Settings } from './types'

type Tab = 'today' | 'history' | 'charts' | 'settings'

const ROUTES: readonly Tab[] = ['today', 'history', 'charts', 'settings']

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

export default function App({ household, email, onHousehold }: Props) {
  const householdId = household.id
  const [units, setUnits] = useState(loadSettings)
  const [tab, setTab] = useHashRoute(ROUTES, 'today')
  const [draft, setDraft] = useState<{ entry: Entry; isNew: boolean } | null>(null)
  const closeDraft = useBackToClose(draft !== null, useCallback(() => setDraft(null), []))
  const [toast, setToast] = useState<Toast | null>(null)
  const notify = useCallback((message: string) => setToast({ id: Date.now(), message }), [])
  const { entries, pending, online, save, drop, replaceAll, add } = useEntries(householdId, onHousehold, notify)
  const list = entries ?? []
  // Tick every second while a timer runs; otherwise often enough for "5m ago" labels.
  const now = useNow(list.some(isRunning) ? 1000 : 30_000)

  // Units and time format are per device; the baby's details and the feed interval are shared by the household.
  // `??` covers a household cached on this phone before the interval moved to it.
  const settings: Settings = {
    ...units,
    babyName: household.baby_name,
    birthDate: household.birth_date ?? '',
    feedIntervalMin: household.feed_interval_min ?? units.feedIntervalMin,
    feedIntervalFrom: household.feed_interval_from ?? units.feedIntervalFrom,
  }

  useEffect(() => {
    saveSettings(units)
  }, [units])
  useEffect(() => {
    applyTheme(units.theme)
    return followSystemTheme(() => units.theme)
  }, [units.theme])
  // Block body on purpose: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const actions = useMemo<Actions>(() => {
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
  }, [save, drop])

  const changeSettings = (next: Settings) => {
    setUnits(next)
    const shared: HouseholdChanges = {
      baby_name: next.babyName,
      birth_date: next.birthDate || null,
      feed_interval_min: next.feedIntervalMin,
      feed_interval_from: next.feedIntervalFrom,
    }
    const changed = Object.fromEntries(
      Object.entries(shared).filter(([key, value]) => household[key as keyof HouseholdChanges] !== value),
    ) as HouseholdChanges
    if (Object.keys(changed).length > 0) {
      onHousehold({ ...household, ...changed })
      updateHousehold(householdId, changed).catch((e: Error) =>
        setToast({ id: Date.now(), message: `Couldn’t save: ${e.message}` }),
      )
    }
  }

  const age = formatAge(settings.birthDate, now)

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{settings.babyName ? `${settings.babyName}` : 'Baby Tracker'}</h1>
          {age ? <p className="muted">{age}</p> : <p className="muted">Sleep, feeds, diapers and more</p>}
          {(!online || pending > 0) && (
            <p className={online ? 'sync-status' : 'sync-status offline'} role="status">
              {online ? 'Syncing' : 'Offline'}
              {pending > 0 ? ` · ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this phone` : ' · logs save on this phone'}
            </p>
          )}
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
            bulk={{ replaceAll, add }}
            pending={pending}
            onOpenToday={() => setTab('today')}
          />
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setTab(t.id)}
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
          onClose={closeDraft}
          onSave={(entry) => {
            actions.save(entry)
            closeDraft()
          }}
          onDelete={() => {
            actions.remove(draft.entry)
            closeDraft()
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
