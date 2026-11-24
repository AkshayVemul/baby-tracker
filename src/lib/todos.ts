import type { Entry, Todo, TimeFormat } from '../types'
import { addDays, formatTime, fromLocalInput, startOfDay, toDateInput } from './time'

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Whether `todo` comes up on the day starting at `day` (local midnight). */
export function isDue(todo: Todo, day: number): boolean {
  const { repeat } = todo
  if (repeat.every === 'day') return true
  if (repeat.every === 'week') return repeat.weekdays.includes(new Date(day).getDay())
  const from = startOfDay(fromLocalInput(repeat.from))
  // Rounded, since a day across a daylight-saving change is 23 or 25 hours.
  const days = Math.round((day - from) / 86_400_000)
  return days >= 0 && days % repeat.days === 0
}

/** The next day from `day` on (inclusive) that `todo` comes up; null if it never does (no weekdays picked). */
export function nextDueDay(todo: Todo, day: number): number | null {
  for (let i = 0; i < 400; i++) {
    const candidate = addDays(day, i)
    if (isDue(todo, candidate)) return candidate
  }
  return null
}

/** One tick box: a to-do on a day, at one of its times or (with none) any time that day. */
export interface Slot {
  todo: Todo
  /** "08:00", or undefined for any time that day. */
  time?: string
  /** When it's due, for a slot with a time. */
  at?: number
  /** Identifies the slot; stored as the `kind` of the tick entries. */
  key: string
}

/** The tick boxes for `todo` on the day starting at `day`, earliest first. */
export function slotsFor(todo: Todo, day: number): Slot[] {
  const date = toDateInput(day)
  if (todo.times.length === 0) return [{ todo, key: `${todo.id}|${date}|` }]
  return todo.times.toSorted().map((time) => ({ todo, time, at: fromLocalInput(`${date}T${time}`), key: `${todo.id}|${date}|${time}` }))
}

/** The ticks (`todo` entries) by slot key. Two phones ticking the same slot offline make two; either counts. */
export function ticksBySlot(ticks: Entry[]): Map<string, Entry[]> {
  const bySlot = new Map<string, Entry[]>()
  for (const tick of ticks) {
    if (tick.type !== 'todo' || !tick.kind) continue
    bySlot.set(tick.kind, [...(bySlot.get(tick.kind) ?? []), tick])
  }
  return bySlot
}

/** "Every day · 8:00 AM, 8:00 PM", "Every 3 days", "Mon, Wed, Fri · 9:00 AM" */
export function repeatText(todo: Todo, format: TimeFormat): string {
  const { repeat } = todo
  const when =
    repeat.every === 'day'
      ? 'Every day'
      : repeat.every === 'days'
        ? `Every ${repeat.days} days`
        : repeat.weekdays.length === 7
          ? 'Every day'
          : repeat.weekdays.toSorted().map((d) => WEEKDAYS[d]).join(', ') || 'No days picked'
  const times = todo.times.toSorted().map((time) => formatTime(fromLocalInput(`2000-01-01T${time}`), format))
  return times.length ? `${when} · ${times.join(', ')}` : when
}

/** Today's slots across `todos`, with whether each is done; for the summary on the Today screen. */
export function todaysSlots(todos: Todo[], ticks: Entry[], now: number): { slot: Slot; done: boolean }[] {
  const day = startOfDay(now)
  const bySlot = ticksBySlot(ticks)
  return todos
    .filter((todo) => isDue(todo, day))
    .flatMap((todo) => slotsFor(todo, day))
    .map((slot) => ({ slot, done: bySlot.has(slot.key) }))
}
