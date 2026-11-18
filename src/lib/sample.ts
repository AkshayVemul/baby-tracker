import type { Entry } from '../types'
import { newId } from './storage'
import { addDays, atHour, HOUR, MINUTE, startOfDay } from './time'

const jitter = (minutes: number) => (Math.random() * 2 - 1) * minutes * MINUTE
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

/**
 * A believable month for a ~3-month-old, so the charts have something to show:
 * night sleep with two wake-ups for feeds, three naps, feeds every ~3h, 6–8 diapers,
 * weekly weigh-ins. Nothing is generated after `now`.
 */
export function sampleEntries(now: number, days = 30): Entry[] {
  const entries: Entry[] = []
  const add = (e: Omit<Entry, 'id'>) => {
    if (e.start <= now && (e.end ?? 0) <= now) entries.push({ id: newId(), ...e })
  }
  const today = startOfDay(now)

  for (let i = days; i >= 0; i--) {
    const day = addDays(today, -i)
    // Night: bed ~19:45, wake for feeds around 23:30 and 03:30, up ~06:45.
    const bed = atHour(day, 19) + 45 * MINUTE + jitter(25)
    const wake1 = atHour(day, 23) + 30 * MINUTE + jitter(40)
    const wake2 = atHour(addDays(day, 1), 3) + 30 * MINUTE + jitter(40)
    const up = atHour(addDays(day, 1), 6) + 45 * MINUTE + jitter(25)
    const nightFeed = (at: number) => {
      add({ type: 'feed', kind: 'breast', side: pick(['left', 'right']), start: at + 5 * MINUTE, end: at + 22 * MINUTE + jitter(5) })
      add({ type: 'diaper', kind: pick(['wet', 'wet', 'mixed']), start: at + 2 * MINUTE })
    }
    add({ type: 'sleep', start: bed, end: wake1 })
    nightFeed(wake1)
    add({ type: 'sleep', start: wake1 + 35 * MINUTE, end: wake2 })
    nightFeed(wake2)
    add({ type: 'sleep', start: wake2 + 35 * MINUTE, end: up })

    // Naps.
    for (const [hour, length] of [[9, 75], [12.5, 90], [16, 40]] as const) {
      const start = day + hour * HOUR + jitter(30)
      add({ type: 'sleep', start, end: start + (length + jitter(20) / MINUTE) * MINUTE })
    }

    // Daytime feeds: breast, with a bottle in the evening.
    for (const hour of [7, 10.5, 14, 17]) {
      const start = day + hour * HOUR + jitter(20)
      add({ type: 'feed', kind: 'breast', side: pick(['left', 'right']), start, end: start + (15 + Math.random() * 10) * MINUTE })
    }
    add({ type: 'feed', kind: 'bottle', milk: pick(['breast', 'formula']), amountMl: 90 + Math.round(Math.random() * 6) * 10, start: atHour(day, 19) + jitter(15) })

    // Daytime diapers.
    for (const hour of [7.2, 10, 12, 15, 18]) {
      add({ type: 'diaper', kind: pick(['wet', 'wet', 'wet', 'dirty', 'mixed']), start: day + hour * HOUR + jitter(30) })
    }

    add({ type: 'activity', kind: 'tummy', start: day + 11 * HOUR + jitter(20), end: day + 11 * HOUR + 10 * MINUTE + jitter(3) })
    if (i % 2 === 0) add({ type: 'activity', kind: 'bath', start: atHour(day, 18) + 50 * MINUTE, end: atHour(day, 19) + 5 * MINUTE })
    if (i % 3 === 0) add({ type: 'pump', side: 'both', amountMl: 80 + Math.round(Math.random() * 6) * 10, start: day + 15 * HOUR })

    if (i % 7 === 0) {
      const weeksAgo = i / 7
      add({ type: 'growth', start: day + 10 * HOUR, weightKg: 6.1 - weeksAgo * 0.18, heightCm: 61 - weeksAgo * 0.7, headCm: 40 - weeksAgo * 0.3 })
    }
  }

  const fever = addDays(today, -9) + 18 * HOUR
  add({ type: 'health', kind: 'temperature', tempC: 38.2, start: fever, notes: 'Bit warm after vaccines' })
  add({ type: 'health', kind: 'medicine', medicine: 'Paracetamol', dose: '2.5 ml', start: fever + 10 * MINUTE })
  add({ type: 'health', kind: 'vaccine', start: addDays(today, -9) + 10 * HOUR, notes: '8-week vaccines' })
  add({ type: 'note', start: addDays(today, -4) + 13 * HOUR, notes: 'First proper laugh 😄' })
  return entries
}
