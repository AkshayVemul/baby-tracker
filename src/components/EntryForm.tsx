import { useEffect, useRef, useState, type ReactNode } from 'react'
import { describe } from '../lib/describe'
import { defaultKind, durationMs, hasBreak, isPausable, isTimed, MILKS, partsProblem, SIDES, TYPE_ORDER, TYPES, withParts, type Option } from '../lib/entries'
import { formatDuration, formatTime, fromLocalInput, MINUTE, nearestTime, toLocalInput, toTimeInput } from '../lib/time'
import { units, type Measure } from '../lib/units'
import type { Entry, EntryType, Segment, Settings } from '../types'
import { Icon } from './Icon'

interface Props {
  initial: Entry
  isNew: boolean
  settings: Settings
  onSave: (entry: Entry) => void
  onDelete: () => void
  onClose: () => void
  /** A feed that ended just before this one, which it can be merged into (e.g. this is a bottle top-up). */
  mergeWith?: Entry
  onMerge?: () => void
}

/** Measurements are edited as text in the user's units and converted back to metric on save. */
const MEASURES = { amount: 'volume', weight: 'weight', height: 'length', head: 'length', temp: 'temp' } as const
type MeasureField = keyof typeof MEASURES

/** One part of a feed or pump being edited: a side or the bottle, with its times as typed ("21:05"). */
interface PartDraft {
  side: Segment['side']
  start: string
  end: string
  /** The part as saved, so untouched times keep their seconds and its pauses carry over. */
  original?: Segment
}

const FEED_PARTS: Option[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bottle', label: 'Bottle' },
]
const PUMP_PARTS = FEED_PARTS.slice(0, 2)

function toDraft(segment: Segment): PartDraft {
  return { side: segment.side, start: toTimeInput(segment.start), end: segment.end == null ? '' : toTimeInput(segment.end), original: segment }
}

/** The part to add after `previous`: the other side (after a bottle, the left), for 5 minutes from where it ended. */
function nextDraft(previous: Segment): PartDraft {
  const from = previous.end ?? previous.start
  return { side: previous.side === 'left' ? 'right' : 'left', start: toTimeInput(from), end: toTimeInput(from + 5 * MINUTE) }
}

const METRIC_FIELD: Record<MeasureField, keyof Entry> = {
  amount: 'amountMl',
  weight: 'weightKg',
  height: 'heightCm',
  head: 'headCm',
  temp: 'tempC',
}

export function EntryForm({ initial, isNew, settings, onSave, onDelete, onClose, mergeWith, onMerge }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [type, setType] = useState<EntryType>(initial.type)
  const [kind, setKind] = useState(initial.kind)
  const [side, setSide] = useState(initial.side)
  const [milk, setMilk] = useState(initial.milk)
  const [start, setStart] = useState(toLocalInput(initial.start))
  const [end, setEnd] = useState(initial.end === undefined ? '' : toLocalInput(initial.end))
  const [text, setText] = useState({
    food: initial.food ?? '',
    medicine: initial.medicine ?? '',
    dose: initial.dose ?? '',
    notes: initial.notes ?? '',
  })
  const [measures, setMeasures] = useState(() => {
    const values = {} as Record<MeasureField, string>
    for (const field of Object.keys(MEASURES) as MeasureField[]) {
      const metric = initial[METRIC_FIELD[field]] as number | undefined
      values[field] = metric === undefined ? '' : String(units[MEASURES[field]].toDisplay(metric, settings))
    }
    return values
  })
  // Whole minutes of break time (pauses, unlatching) taken off a breastfeed or pump session.
  const [breaks, setBreaks] = useState(initial.pausedMs ? String(Math.round(initial.pausedMs / MINUTE)) : '')
  const [error, setError] = useState('')
  // A feed or pump in parts (sides and bottle top-ups), each with its own times; null while it's a single part.
  const [parts, setParts] = useState<PartDraft[] | null>(() =>
    initial.segments && initial.segments.length > 1 ? initial.segments.map(toDraft) : null,
  )

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const config = TYPES[type]
  const timed = isTimed({ type, kind })
  const partsAllowed = (type === 'feed' && (kind === 'breast' || kind === 'bottle')) || type === 'pump'
  const activeParts = partsAllowed ? parts : null
  // A breastfeed with a bottle top-up as one of its parts takes the bottle's amount and milk too.
  const hasBottlePart = activeParts?.some((part) => part.side === 'bottle') === true
  const show = {
    kind: !(activeParts && type === 'feed'),
    side: ((type === 'feed' && kind === 'breast') || type === 'pump') && !activeParts,
    amount: (type === 'feed' && (kind === 'bottle' || hasBottlePart)) || type === 'pump',
    milk: type === 'feed' && (kind === 'bottle' || hasBottlePart),
    food: type === 'feed' && kind === 'solids',
    growth: type === 'growth',
    temp: type === 'health' && kind === 'temperature',
    medicine: type === 'health' && kind === 'medicine',
  }
  // Time pickers only hold whole minutes; an untouched field keeps the exact original time (with its seconds),
  // so saving e.g. just a pump amount doesn't shorten the session.
  const [openedAt] = useState(Date.now)
  const startMs = start === toLocalInput(initial.start) ? initial.start : fromLocalInput(start)
  const endMs = initial.end !== undefined && end === toLocalInput(initial.end) ? initial.end : fromLocalInput(end)
  const pausable = isPausable({ type, kind })
  const breakMs = pausable && Number(breaks) > 0 ? Number(breaks) * MINUTE : 0
  const duration = timed && !Number.isNaN(startMs) && !Number.isNaN(endMs) ? endMs - startMs - breakMs : null

  /**
   * The parts as times: each typed time is taken on whichever day puts it nearest the time before it, so a feed past
   * midnight needs no dates. Only the last part may be left without an end (still running).
   */
  const resolveParts = (drafts: PartDraft[]): Segment[] => {
    let previous = initial.start
    // A typed time in the same minute as the time before it (which may have seconds) means right after it.
    const typed = (value: string) => {
      const at = nearestTime(value, previous)
      return at < previous && previous - at < MINUTE ? previous : at
    }
    return drafts.map((draft, i) => {
      const { original } = draft
      const start = original && draft.start === toTimeInput(original.start) ? original.start : typed(draft.start)
      if (!Number.isNaN(start)) previous = start
      const end =
        draft.end === ''
          ? i === drafts.length - 1
            ? undefined
            : Number.NaN
          : original?.end != null && draft.end === toTimeInput(original.end)
            ? original.end
            : typed(draft.end)
      if (end !== undefined && !Number.isNaN(end)) previous = end
      const part: Segment = { side: draft.side, start }
      if (end !== undefined) part.end = end
      const paused = end === undefined ? original?.pausedMs : Math.min(original?.pausedMs ?? 0, Math.max(0, end - start))
      if (paused) part.pausedMs = paused
      return part
    })
  }
  const resolvedParts = activeParts ? resolveParts(activeParts) : null
  const sortedParts = resolvedParts?.toSorted((a, b) => a.start - b.start)
  const partsEntry =
    sortedParts && !partsProblem(sortedParts) ? withParts({ id: initial.id, type, kind, start: 0 }, sortedParts) : null

  /** Changing the parts also clears a complaint about them. */
  const updateParts = (next: PartDraft[] | null) => {
    setParts(next)
    setError('')
  }

  const changePart = (index: number, change: Partial<PartDraft>) => {
    if (activeParts) updateParts(activeParts.map((part, i) => (i === index ? { ...part, ...change } : part)))
  }

  /** Splits a single feed or pump into parts: what's in the form so far, and another part after it. */
  const addPart = () => {
    if (activeParts && resolvedParts) {
      updateParts([...activeParts, nextDraft(resolvedParts[resolvedParts.length - 1])])
      return
    }
    const first: Segment = {
      side: type === 'feed' && kind === 'bottle' ? 'bottle' : side === 'right' ? 'right' : 'left',
      start: startMs,
      end: endMs,
    }
    if (breakMs) first.pausedMs = breakMs
    updateParts([toDraft(first), nextDraft(first)])
  }

  /** Removing all but one part makes it a plain feed or pump again, with that part's times. */
  const removePart = (index: number) => {
    if (!activeParts) return
    const rest = activeParts.filter((_, i) => i !== index)
    if (rest.length > 1) {
      updateParts(rest)
      return
    }
    const [only] = resolveParts(rest)
    updateParts(null)
    if (!Number.isNaN(only.start)) setStart(toLocalInput(only.start))
    setEnd(only.end == null || Number.isNaN(only.end) ? '' : toLocalInput(only.end))
    setBreaks(only.pausedMs ? String(Math.round(only.pausedMs / MINUTE)) : '')
    if (type === 'feed') setKind(only.side === 'bottle' ? 'bottle' : 'breast')
    if (only.side !== 'bottle') setSide(only.side)
  }

  /** Moving the start past the end pushes the end to 5 minutes after it, so the end never needs scrolling back. */
  const changeStart = (value: string) => {
    setStart(value)
    const nextStart = fromLocalInput(value)
    if (timed && !Number.isNaN(nextStart) && !Number.isNaN(endMs) && endMs <= nextStart) {
      setEnd(toLocalInput(nextStart + 5 * MINUTE))
    }
  }

  const changeType = (next: EntryType) => {
    setType(next)
    setKind(defaultKind(next))
    setParts(null)
    setError('')
  }

  const submit = () => {
    if (sortedParts) {
      const problem = partsProblem(sortedParts)
      if (problem) return setError(problem)
    } else {
      if (Number.isNaN(startMs)) return setError('Pick a start time.')
      if (timed && !Number.isNaN(endMs) && endMs < startMs) return setError('The end time is before the start time.')
      if (pausable && breaks.trim() && !(Number(breaks) >= 0)) return setError('Breaks must be a number of minutes.')
      if (duration !== null && duration < 0) return setError('Breaks are longer than the session.')
    }

    const metric: Partial<Record<MeasureField, number>> = {}
    for (const field of Object.keys(MEASURES) as MeasureField[]) {
      const raw = measures[field].trim()
      if (!raw) continue
      const value = Number(raw.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) return setError('Measurements must be positive numbers.')
      metric[field] = units[MEASURES[field]].fromDisplay(value, settings)
    }
    if (show.growth && metric.weight === undefined && metric.height === undefined && metric.head === undefined) {
      return setError('Enter at least one measurement.')
    }
    if (show.temp && metric.temp === undefined) return setError('Enter the temperature.')

    let entry: Entry = { id: initial.id, type, start: startMs }
    if (config.kinds) entry.kind = kind
    if (sortedParts) {
      entry = withParts(entry, sortedParts)
      // Still running and paused: keep the open pause.
      if (entry.end === undefined && initial.pausedAt !== undefined) entry.pausedAt = initial.pausedAt
    } else {
      if (timed && !Number.isNaN(endMs)) entry.end = endMs
      if (pausable) {
        let paused = breakMs
        if (initial.pausedAt !== undefined) {
          // Still paused and running: keep the open pause. Given an end time: the pause lasted until then.
          if (entry.end === undefined) entry.pausedAt = initial.pausedAt
          else paused += Math.max(0, entry.end - initial.pausedAt)
        }
        if (paused > 0) entry.pausedMs = paused
      }
      if (show.side && side) entry.side = side
    }
    if (show.amount && metric.amount !== undefined) entry.amountMl = Math.round(metric.amount)
    if (show.milk && milk) entry.milk = milk
    if (show.food && text.food.trim()) entry.food = text.food.trim()
    if (show.growth) {
      entry.weightKg = metric.weight
      entry.heightCm = metric.height
      entry.headCm = metric.head
    }
    if (show.temp) entry.tempC = metric.temp
    if (show.medicine) {
      if (text.medicine.trim()) entry.medicine = text.medicine.trim()
      if (text.dose.trim()) entry.dose = text.dose.trim()
    }
    if (text.notes.trim()) entry.notes = text.notes.trim()
    onSave(JSON.parse(JSON.stringify(entry)) as Entry) // drops undefined fields
  }

  const measureInput = (field: MeasureField, label: string) => {
    const measure: Measure = MEASURES[field]
    return (
      <label className="field">
        <span>
          {label} ({units[measure].label(settings)})
        </span>
        <input
          inputMode="decimal"
          value={measures[field]}
          onChange={(e) => setMeasures({ ...measures, [field]: e.target.value })}
        />
      </label>
    )
  }

  const textInput = (field: keyof typeof text, label: string, placeholder?: string) => (
    <label className="field">
      <span>{label}</span>
      <input value={text[field]} placeholder={placeholder} onChange={(e) => setText({ ...text, [field]: e.target.value })} />
    </label>
  )

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="entry-form-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <header className="sheet-head">
          <h2 id="entry-form-title">
            {config.emoji} {isNew ? `Log ${config.label.toLowerCase()}` : `Edit ${config.label.toLowerCase()}`}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        {isNew && (
          <Chips
            label="Type"
            options={TYPE_ORDER.map((t) => ({ value: t, label: `${TYPES[t].emoji} ${TYPES[t].label}` }))}
            value={type}
            onChange={(v) => changeType(v as EntryType)}
          />
        )}
        {config.kinds && show.kind && <Chips label="Kind" options={config.kinds} value={kind} onChange={setKind} />}
        {show.side && <Chips label="Side" options={SIDES} value={side} onChange={(v) => setSide(v as Entry['side'])} />}
        {activeParts && resolvedParts && (
          <fieldset className="field">
            <legend>{type === 'pump' ? 'Sides' : 'Sides and bottle'}</legend>
            <ol className="parts">
              {activeParts.map((part, i) => {
                const resolved = resolvedParts[i]
                const ms =
                  resolved.end == null || Number.isNaN(resolved.end) || Number.isNaN(resolved.start)
                    ? null
                    : resolved.end - resolved.start - (resolved.pausedMs ?? 0)
                return (
                  // Parts have no ids; the list only changes by adding at the end or removing one.
                  <li key={`${i}-${activeParts.length}`} className="part">
                    <div className="chips" role="group" aria-label={`Part ${i + 1}`}>
                      {(type === 'pump' ? PUMP_PARTS : FEED_PARTS).map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          className={o.value === part.side ? 'chip active' : 'chip'}
                          aria-pressed={o.value === part.side}
                          onClick={() => changePart(i, { side: o.value as Segment['side'] })}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <span className="part-times">
                      <input
                        type="time"
                        aria-label={`Part ${i + 1} start`}
                        value={part.start}
                        onChange={(e) => changePart(i, { start: e.target.value })}
                      />
                      <span aria-hidden="true">–</span>
                      <input
                        type="time"
                        aria-label={`Part ${i + 1} end`}
                        value={part.end}
                        onChange={(e) => changePart(i, { end: e.target.value })}
                      />
                    </span>
                    <span className="muted small part-length">
                      {ms === null ? (part.end === '' ? 'running' : '') : formatDuration(Math.max(0, ms))}
                      {resolved.pausedMs ? ` · ${formatDuration(resolved.pausedMs)} paused` : ''}
                    </span>
                    <button type="button" className="icon-btn" aria-label={`Remove part ${i + 1}`} onClick={() => removePart(i)}>
                      <Icon name="trash" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </fieldset>
        )}
        {partsAllowed && !(type === 'pump' && side === 'both' && !activeParts) && (
          <button
            type="button"
            className="btn small add-part"
            disabled={activeParts ? resolvedParts?.at(-1)?.end == null : Number.isNaN(startMs) || Number.isNaN(endMs)}
            onClick={addPart}
          >
            <Icon name="plus" /> {type === 'pump' ? 'Add a side' : 'Add a side or bottle'}
          </button>
        )}
        {show.milk && <Chips label="Milk" options={MILKS} value={milk} onChange={(v) => setMilk(v as Entry['milk'])} />}

        {show.amount && measureInput('amount', 'Amount')}
        {show.food && textInput('food', 'Food', 'e.g. banana, rice cereal')}
        {show.growth && (
          <div className="grid-3">
            {measureInput('weight', 'Weight')}
            {measureInput('height', 'Length')}
            {measureInput('head', 'Head')}
          </div>
        )}
        {show.temp && measureInput('temp', 'Temperature')}
        {show.medicine && (
          <div className="grid-2">
            {textInput('medicine', 'Medicine', 'e.g. Paracetamol')}
            {textInput('dose', 'Dose', 'e.g. 2.5 ml')}
          </div>
        )}

        {!activeParts && (
          <div className="time-row">
            <label className="field">
              <span>{timed ? 'Start' : 'Time'}</span>
              <input type="datetime-local" value={start} onChange={(e) => changeStart(e.target.value)} required />
            </label>
            {timed && (
              <label className="field">
                <span>End</span>
                <span className="input-with-btn">
                  <input type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
                  <button type="button" className="btn small" onClick={() => setEnd(toLocalInput(Date.now()))}>
                    Now
                  </button>
                </span>
              </label>
            )}
          </div>
        )}
        {pausable && !activeParts && (
          <label className="field">
            <span>Breaks (minutes not {type === 'pump' ? 'pumping' : 'feeding'})</span>
            <input inputMode="numeric" placeholder="0" value={breaks} onChange={(e) => setBreaks(e.target.value)} />
          </label>
        )}
        {activeParts && (
          <p className="muted small">
            {partsEntry
              ? `${formatTime(partsEntry.start, settings.timeFormat)}${partsEntry.end === undefined ? '' : ` – ${formatTime(partsEntry.end, settings.timeFormat)}`} · ${type === 'pump' ? 'pumping' : 'feeding'} ${formatDuration(durationMs(partsEntry, openedAt))}${hasBreak(partsEntry) ? `, ${formatDuration(partsEntry.pausedMs ?? 0)} of breaks` : ''}`
              : 'Each part needs a start and end, one after another.'}
          </p>
        )}
        {timed && !activeParts && (
          <p className="muted small">
            {duration !== null && duration >= 0
              ? `Duration ${formatDuration(duration)}${breakMs ? ` after ${formatDuration(breakMs)} of breaks` : ''}`
              : duration === null
                ? 'Leave the end empty to keep the timer running.'
                : ''}
          </p>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={text.notes}
            placeholder={type === 'health' && kind === 'symptom' ? 'e.g. rash on cheeks, congested' : 'Optional'}
            onChange={(e) => setText({ ...text, notes: e.target.value })}
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {mergeWith && onMerge && (
          <div className="merge-hint">
            <p className="muted small">Part of the same feeding? Combine it with the feed just before.</p>
            <button type="button" className="btn small" onClick={onMerge}>
              Merge with the {formatTime(mergeWith.start, settings.timeFormat)} feed
              {describe(mergeWith, settings, openedAt) ? ` (${describe(mergeWith, settings, openedAt)})` : ''}
            </button>
          </div>
        )}

        <footer className="sheet-actions">
          {!isNew && (
            <button type="button" className="btn danger" onClick={onDelete}>
              <Icon name="trash" /> Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  )
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option[]
  value: string | undefined
  onChange: (value: string) => void
}): ReactNode {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === value ? 'chip active' : 'chip'}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
