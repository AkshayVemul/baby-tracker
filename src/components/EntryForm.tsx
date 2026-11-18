import { useEffect, useRef, useState, type ReactNode } from 'react'
import { defaultKind, isTimed, MILKS, SIDES, TYPE_ORDER, TYPES, type Option } from '../lib/entries'
import { formatDuration, fromLocalInput, MINUTE, toLocalInput } from '../lib/time'
import { units, type Measure } from '../lib/units'
import type { Entry, EntryType, Settings } from '../types'
import { Icon } from './Icon'

interface Props {
  initial: Entry
  isNew: boolean
  settings: Settings
  onSave: (entry: Entry) => void
  onDelete: () => void
  onClose: () => void
}

/** Measurements are edited as text in the user's units and converted back to metric on save. */
const MEASURES = { amount: 'volume', weight: 'weight', height: 'length', head: 'length', temp: 'temp' } as const
type MeasureField = keyof typeof MEASURES

const METRIC_FIELD: Record<MeasureField, keyof Entry> = {
  amount: 'amountMl',
  weight: 'weightKg',
  height: 'heightCm',
  head: 'headCm',
  temp: 'tempC',
}

export function EntryForm({ initial, isNew, settings, onSave, onDelete, onClose }: Props) {
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
  const [error, setError] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const config = TYPES[type]
  const timed = isTimed({ type, kind })
  const show = {
    side: (type === 'feed' && kind === 'breast') || type === 'pump',
    amount: (type === 'feed' && kind === 'bottle') || type === 'pump',
    milk: type === 'feed' && kind === 'bottle',
    food: type === 'feed' && kind === 'solids',
    growth: type === 'growth',
    temp: type === 'health' && kind === 'temperature',
    medicine: type === 'health' && kind === 'medicine',
  }
  const startMs = fromLocalInput(start)
  const endMs = fromLocalInput(end)
  const duration = timed && !Number.isNaN(startMs) && !Number.isNaN(endMs) ? endMs - startMs : null

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
    setError('')
  }

  const submit = () => {
    if (Number.isNaN(startMs)) return setError('Pick a start time.')
    if (timed && !Number.isNaN(endMs) && endMs < startMs) return setError('The end time is before the start time.')

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

    const entry: Entry = { id: initial.id, type, start: startMs }
    if (config.kinds) entry.kind = kind
    if (timed && !Number.isNaN(endMs)) entry.end = endMs
    if (show.side && side) entry.side = side
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
        {config.kinds && <Chips label="Kind" options={config.kinds} value={kind} onChange={setKind} />}
        {show.side && <Chips label="Side" options={SIDES} value={side} onChange={(v) => setSide(v as Entry['side'])} />}
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
        {timed && (
          <p className="muted small">
            {duration !== null && duration >= 0
              ? `Duration ${formatDuration(duration)}`
              : 'Leave the end empty to keep the timer running.'}
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
