import { useCallback, useState } from 'react'
import { useBackToClose } from '../hooks/useHashRoute'
import { newId } from '../lib/storage'
import { formatDay, formatTime, startOfDay } from '../lib/time'
import { isDue, nextDueDay, repeatText, slotsFor, ticksBySlot, type Slot } from '../lib/todos'
import type { Entry, Settings, Todo } from '../types'
import { Icon } from './Icon'
import { TodoForm } from './TodoForm'

interface Props {
  todos: Todo[]
  /** Ticks: entries of type `todo`. */
  ticks: Entry[]
  settings: Settings
  now: number
  onToggle: (slot: Slot) => void
  onTodos: (todos: Todo[]) => void
}

const GROUPS: [Todo['who'], string][] = [
  ['baby', '👶 Baby'],
  ['mom', '👩 Mom'],
]

const blankTodo = (who: Todo['who']): Todo => ({ id: newId(), title: '', who, repeat: { every: 'day' }, times: [] })

/** Today's to-dos for the baby and mom, ticked off as they're done; the list and its repeats are edited here too. */
export function TodoView({ todos, ticks, settings, now, onToggle, onTodos }: Props) {
  const [editing, setEditing] = useState<{ todo: Todo; isNew: boolean } | null>(null)
  const close = useBackToClose(editing !== null, useCallback(() => setEditing(null), []))
  const today = startOfDay(now)
  const bySlot = ticksBySlot(ticks)
  const later = todos.filter((todo) => !isDue(todo, today))

  const save = (todo: Todo) => {
    onTodos(editing?.isNew ? [...todos, todo] : todos.map((t) => (t.id === todo.id ? todo : t)))
    close()
  }

  const remove = (todo: Todo) => {
    if (!window.confirm(`Delete “${todo.title}” from the to-do list for everyone?`)) return
    onTodos(todos.filter((t) => t.id !== todo.id))
    close()
  }

  const row = (todo: Todo, slots: Slot[]) => (
    <li key={todo.id} className="todo">
      <button type="button" className="todo-title" onClick={() => setEditing({ todo, isNew: false })} aria-label={`Edit ${todo.title}`}>
        <strong>{todo.title}</strong>
        <span className="muted small">
          {slots.length ? repeatText(todo, settings.timeFormat) : `Next: ${nextText(todo, today, now)}`}
        </span>
      </button>
      {slots.length > 0 && (
        <div className="todo-ticks">
          {slots.map((slot) => {
            const done = bySlot.get(slot.key)?.[0]
            const late = !done && slot.at !== undefined && slot.at < now
            const when = slot.at === undefined ? 'Done' : formatTime(slot.at, settings.timeFormat)
            return (
              <button
                key={slot.key}
                type="button"
                className={done ? 'tick done' : late ? 'tick late' : 'tick'}
                aria-pressed={done !== undefined}
                aria-label={`${todo.title}${slot.at === undefined ? '' : ` at ${when}`}`}
                onClick={() => onToggle(slot)}
              >
                <span className="tick-box" aria-hidden="true">
                  {done && <Icon name="check" size={14} />}
                </span>
                {when}
                {done && <span className="small"> · done {formatTime(done.start, settings.timeFormat)}</span>}
                {late && <span className="small"> · late</span>}
              </button>
            )
          })}
        </div>
      )}
    </li>
  )

  return (
    <div className="stack">
      <section className="card" aria-labelledby="todos-title">
        <div className="todo-head">
          <h2 id="todos-title">To-dos</h2>
          <span className="muted small grow">{formatDay(today, now)}</span>
          <button className="btn small" onClick={() => setEditing({ todo: blankTodo('baby'), isNew: true })}>
            <Icon name="plus" /> Add
          </button>
        </div>
        {todos.length === 0 ? (
          <p className="muted">
            Nothing yet. Add what needs doing each day, like vitamin D drops for the baby or meds for mom, and tick it off when
            it’s done. Everyone in the household shares the list.
          </p>
        ) : (
          GROUPS.map(([who, label]) => {
            const due = todos.filter((todo) => todo.who === who && isDue(todo, today))
            return (
              <div key={who} className="todo-group">
                <h3>{label}</h3>
                {due.length === 0 ? (
                  <p className="muted small">Nothing today.</p>
                ) : (
                  <ul className="todos">{due.map((todo) => row(todo, slotsFor(todo, today)))}</ul>
                )}
              </div>
            )
          })
        )}
      </section>

      {later.length > 0 && (
        <section className="card" aria-labelledby="todos-later">
          <h3 id="todos-later">Not today</h3>
          <ul className="todos">{later.map((todo) => row(todo, []))}</ul>
        </section>
      )}

      {editing && (
        <TodoForm
          key={editing.todo.id}
          initial={editing.todo}
          isNew={editing.isNew}
          onSave={save}
          onDelete={() => remove(editing.todo)}
          onClose={close}
        />
      )}
    </div>
  )
}

function nextText(todo: Todo, today: number, now: number): string {
  const next = nextDueDay(todo, today)
  return next === null ? 'never (no days picked)' : formatDay(next, now)
}
