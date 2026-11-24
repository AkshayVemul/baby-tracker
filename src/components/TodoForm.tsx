import { useEffect, useRef, useState } from 'react'
import { WEEKDAYS } from '../lib/todos'
import { toDateInput } from '../lib/time'
import type { Repeat, Todo } from '../types'
import { Icon } from './Icon'

interface Props {
  initial: Todo
  isNew: boolean
  onSave: (todo: Todo) => void
  onDelete: () => void
  onClose: () => void
}

const WHO: [Todo['who'], string][] = [
  ['baby', 'Baby'],
  ['mom', 'Mom'],
]

const REPEATS: [Repeat['every'], string][] = [
  ['day', 'Every day'],
  ['days', 'Every few days'],
  ['week', 'Some days of the week'],
]

export function TodoForm({ initial, isNew, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(initial.title)
  const [who, setWho] = useState(initial.who)
  const [every, setEvery] = useState(initial.repeat.every)
  const [days, setDays] = useState(initial.repeat.every === 'days' ? String(initial.repeat.days) : '2')
  const [from, setFrom] = useState(() => (initial.repeat.every === 'days' ? initial.repeat.from : toDateInput(Date.now())))
  const [weekdays, setWeekdays] = useState(initial.repeat.every === 'week' ? initial.repeat.weekdays : [1, 2, 3, 4, 5])
  const [times, setTimes] = useState(initial.times)
  const [error, setError] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const toggleWeekday = (day: number) =>
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].toSorted()))

  const submit = () => {
    if (!title.trim()) return setError('Give it a name, e.g. “Vitamin D drops”.')
    let repeat: Repeat = { every: 'day' }
    if (every === 'days') {
      const n = Number(days)
      if (!Number.isInteger(n) || n < 2) return setError('“Every few days” needs a whole number of days, 2 or more.')
      if (!from) return setError('Pick the day it starts.')
      repeat = { every: 'days', days: n, from }
    } else if (every === 'week') {
      if (weekdays.length === 0) return setError('Pick at least one day of the week.')
      repeat = { every: 'week', weekdays }
    }
    const picked = times.filter(Boolean)
    if (picked.length !== times.length) return setError('Fill in or remove the empty time.')
    if (new Set(picked).size !== picked.length) return setError('The same time is in the list twice.')
    onSave({ id: initial.id, title: title.trim(), who, repeat, times: picked.toSorted() })
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="todo-form-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <header className="sheet-head">
          <h2 id="todo-form-title">{isNew ? 'New to-do' : 'Edit to-do'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <label className="field">
          <span>What</span>
          <input value={title} placeholder="e.g. Vitamin D drops, take iron tablet" onChange={(e) => setTitle(e.target.value)} />
        </label>

        <ChipGroup label="For" options={WHO} value={who} onChange={setWho} />
        <ChipGroup label="Repeats" options={REPEATS} value={every} onChange={setEvery} />

        {every === 'days' && (
          <div className="grid-2">
            <label className="field">
              <span>Every (days)</span>
              <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
            <label className="field">
              <span>Starting</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
          </div>
        )}
        {every === 'week' && (
          <fieldset className="field">
            <legend>On</legend>
            <div className="chips">
              {WEEKDAYS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={weekdays.includes(day) ? 'chip active' : 'chip'}
                  aria-pressed={weekdays.includes(day)}
                  onClick={() => toggleWeekday(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="field">
          <legend>Times</legend>
          <p className="muted small">
            {times.length === 0 ? 'No times: it’s ticked once that day, whenever it’s done.' : 'Each time gets its own tick.'}
          </p>
          {times.map((time, i) => (
            // Times have no ids; the list only changes by adding at the end or removing one.
            <span key={`${i}-${times.length}`} className="input-with-btn">
              <input
                type="time"
                aria-label={`Time ${i + 1}`}
                value={time}
                onChange={(e) => setTimes(times.map((t, j) => (j === i ? e.target.value : t)))}
              />
              <button type="button" className="icon-btn" aria-label={`Remove time ${i + 1}`} onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                <Icon name="trash" />
              </button>
            </span>
          ))}
          <button type="button" className="btn small add-part" onClick={() => setTimes([...times, times.length ? '' : '09:00'])}>
            <Icon name="plus" /> Add a time
          </button>
        </fieldset>

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

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: [T, string][]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="chips">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={option === value ? 'chip active' : 'chip'}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
