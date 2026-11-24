import { describe, expect, it } from 'vitest'
import type { Entry, Todo } from '../types'
import { alarmLink } from './alarm'
import { addDays, atHour } from './time'
import { isDue, nextDueDay, repeatText, slotsFor, todaysSlots } from './todos'

const monday = new Date(2026, 10, 23).getTime() // Mon 23 Nov 2026, local midnight
const todo = (over: Partial<Todo>): Todo => ({ id: 't', title: 'Vitamin D', who: 'baby', repeat: { every: 'day' }, times: [], ...over })

describe('repeats', () => {
  it('every few days counts from its start date, never before it', () => {
    const everyThird = todo({ repeat: { every: 'days', days: 3, from: '2026-11-23' } })
    expect([0, 1, 2, 3, 6].map((i) => isDue(everyThird, addDays(monday, i)))).toEqual([true, false, false, true, true])
    expect(isDue(everyThird, addDays(monday, -3))).toBe(false)
    expect(nextDueDay(everyThird, addDays(monday, 1))).toBe(addDays(monday, 3))
  })

  it('some days of the week', () => {
    const weekdays = todo({ repeat: { every: 'week', weekdays: [1, 3, 5] } })
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => isDue(weekdays, addDays(monday, i)))).toEqual([true, false, true, false, true, false, false])
    expect(nextDueDay(todo({ repeat: { every: 'week', weekdays: [] } }), monday)).toBeNull()
  })

  it('describes the repeat and times', () => {
    expect(repeatText(todo({ times: ['20:00', '08:00'] }), '24h')).toBe('Every day · 08:00, 20:00')
    expect(repeatText(todo({ repeat: { every: 'week', weekdays: [5, 1] } }), '24h')).toBe('Mon, Fri')
  })
})

describe('slots and ticks', () => {
  it('gives each time its own tick, earliest first, or one for the day without times', () => {
    expect(slotsFor(todo({ times: ['20:00', '08:00'] }), monday).map((s) => [s.key, s.at])).toEqual([
      ['t|2026-11-23|08:00', atHour(monday, 8)],
      ['t|2026-11-23|20:00', atHour(monday, 20)],
    ])
    expect(slotsFor(todo({}), monday).map((s) => s.key)).toEqual(['t|2026-11-23|'])
  })

  it('marks the slots that have a tick, and leaves out to-dos not due today', () => {
    const tick: Entry = { id: 'x', type: 'todo', kind: 't|2026-11-23|08:00', start: atHour(monday, 8) }
    const todos = [todo({ times: ['08:00', '20:00'] }), todo({ id: 'w', repeat: { every: 'week', weekdays: [2] } })]
    expect(todaysSlots(todos, [tick], atHour(monday, 12)).map((s) => [s.slot.time, s.done])).toEqual([
      ['08:00', true],
      ['20:00', false],
    ])
  })
})

describe('alarm link', () => {
  it('runs the Shortcut with the time of day', () => {
    expect(alarmLink(atHour(monday, 21) + 30 * 60_000)).toBe('shortcuts://run-shortcut?name=Baby%20Tracker%20Alarm&input=text&text=21%3A30')
  })
})
