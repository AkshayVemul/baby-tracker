import { useMemo, useState } from 'react'
import { searchText, sortNewestFirst, TYPE_ORDER, TYPES } from '../lib/entries'
import { sleepGaps } from '../lib/gaps'
import { addDays, formatDay, fromLocalInput, startOfDay } from '../lib/time'
import type { Actions, Entry, EntryType, Settings } from '../types'
import { EntryList } from './EntryList'
import { Icon } from './Icon'

interface Props {
  entries: Entry[]
  settings: Settings
  now: number
  actions: Actions
}

const PAGE_DAYS = 14

export function HistoryView({ entries, settings, now, actions }: Props) {
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<EntryType[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [shownDays, setShownDays] = useState(PAGE_DAYS)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromMs = fromLocalInput(from)
    const toMs = fromLocalInput(to)
    return sortNewestFirst(
      entries.filter(
        (e) =>
          (types.length === 0 || types.includes(e.type)) &&
          (Number.isNaN(fromMs) || e.start >= fromMs) &&
          (Number.isNaN(toMs) || e.start < addDays(toMs, 1)) &&
          (!q || searchText(e).includes(q)),
      ),
    )
  }, [entries, query, types, from, to])

  const groups = useMemo(() => {
    const map = new Map<number, Entry[]>()
    for (const e of results) {
      const day = startOfDay(e.start)
      map.set(day, [...(map.get(day) ?? []), e])
    }
    return [...map]
  }, [results])

  // From all entries, so a type filter or search never suggests sleep that's already logged.
  const gaps = useMemo(() => sleepGaps(entries, now), [entries, now])

  const counts = TYPE_ORDER.map((t) => [t, results.filter((e) => e.type === t).length] as const).filter(([, n]) => n > 0)
  const filtering = query || types.length > 0 || from || to

  const toggleType = (t: EntryType) => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])

  return (
    <div className="stack">
      <section className="card filters" aria-label="Search and filter">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search notes, food, medicine, “dirty”, “left”…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search entries"
          />
        </label>
        <div className="chips">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              className={types.includes(t) ? 'chip active' : 'chip'}
              aria-pressed={types.includes(t)}
              onClick={() => toggleType(t)}
            >
              {TYPES[t].emoji} {TYPES[t].label}
            </button>
          ))}
        </div>
        <div className="grid-2">
          <label className="field">
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="result-summary">
          <span>
            <strong>{results.length}</strong> {results.length === 1 ? 'entry' : 'entries'}
            {counts.length > 0 && ' · '}
            {counts.map(([t, n]) => `${n} ${TYPES[t].label.toLowerCase()}`).join(' · ')}
          </span>
          {filtering && (
            <button
              className="btn ghost small"
              onClick={() => {
                setQuery('')
                setTypes([])
                setFrom('')
                setTo('')
              }}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {groups.length === 0 && (
        <div className="card empty">
          <p>{entries.length === 0 ? 'No entries yet.' : 'Nothing matches these filters.'}</p>
        </div>
      )}

      {groups.slice(0, shownDays).map(([day, items]) => (
        <section key={day} aria-label={formatDay(day, now)}>
          <h3 className="section-title">
            {formatDay(day, now)} <span className="muted">· {items.length}</span>
          </h3>
          <EntryList entries={items} gaps={gaps} settings={settings} now={now} actions={actions} />
        </section>
      ))}

      {groups.length > shownDays && (
        <button className="btn block" onClick={() => setShownDays(shownDays + PAGE_DAYS)}>
          Show older days
        </button>
      )}
    </div>
  )
}
