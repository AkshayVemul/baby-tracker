import { useState } from 'react'
import { describe } from '../../lib/describe'
import { TYPES } from '../../lib/entries'
import { addDays, formatDay, formatTime } from '../../lib/time'
import type { Entry, Settings } from '../../types'

interface Props {
  entries: Entry[]
  /** Day starts, oldest first; drawn newest on top. */
  days: number[]
  settings: Settings
  now: number
}

interface Mark {
  entry: Entry
  left: number
  width: number
  kind: 'sleep' | 'feed' | 'diaper'
}

const pct = (ms: number, day: number, next: number) => ((ms - day) / (next - day)) * 100

/**
 * The 24-hour pattern view: one row per day, sleep as blocks, feeds and diapers as marks.
 * Tapping a mark shows what it was underneath.
 */
export function RhythmChart({ entries, days, settings, now }: Props) {
  const [selected, setSelected] = useState<Entry | null>(null)
  const rows = days.toReversed().map((day) => {
    const next = addDays(day, 1)
    const marks: Mark[] = []
    for (const e of entries) {
      if (e.type !== 'sleep' && e.type !== 'feed' && e.type !== 'diaper') continue
      const end = e.type === 'sleep' || e.kind === 'breast' ? (e.end ?? now) : e.start
      if (end < day || e.start >= next) continue
      const from = Math.max(e.start, day)
      const to = Math.min(end, next)
      marks.push({ entry: e, kind: e.type, left: pct(from, day, next), width: pct(to, day, next) - pct(from, day, next) })
    }
    // Sleep first so feed and diaper marks draw on top.
    marks.sort((a, b) => (a.kind === 'sleep' ? 0 : 1) - (b.kind === 'sleep' ? 0 : 1))
    return { day, marks }
  })
  const rowClass = days.length > 14 ? 'rhythm-row compact' : 'rhythm-row'

  return (
    <div className="rhythm">
      <div className="rhythm-axis" aria-hidden="true">
        <span />
        <div>
          {['12a', '6a', '12p', '6p', '12a'].map((h, i) => (
            <span key={i} style={{ left: `${i * 25}%` }}>
              {h}
            </span>
          ))}
        </div>
      </div>
      {rows.map(({ day, marks }) => (
        <div key={day} className={rowClass}>
          <span className="rhythm-label">{formatDay(day, now).replace(/^(\w+) /, '')}</span>
          <div className="rhythm-track">
            {marks.map(({ entry, left, width, kind }) => (
              <button
                key={entry.id}
                className={`mark ${kind}${selected?.id === entry.id ? ' selected' : ''}`}
                style={{ left: `${left}%`, width: kind === 'diaper' ? undefined : `max(4px, ${width}%)` }}
                title={`${TYPES[entry.type].label} ${formatTime(entry.start, settings.timeFormat)}`}
                aria-label={`${TYPES[entry.type].label} at ${formatTime(entry.start, settings.timeFormat)}`}
                onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="rhythm-detail muted small" aria-live="polite">
        {selected
          ? `${TYPES[selected.type].emoji} ${TYPES[selected.type].label} · ${formatTime(selected.start, settings.timeFormat)}${
              selected.end ? ` – ${formatTime(selected.end, settings.timeFormat)}` : ''
            } · ${describe(selected, settings, now)}`
          : 'Tap a block to see details. Shaded hours are night (7pm–7am).'}
      </p>
    </div>
  )
}
