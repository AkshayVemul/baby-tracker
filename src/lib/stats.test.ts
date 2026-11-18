import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { dailyStats, summarize } from './stats'
import { addDays, atHour, HOUR, MINUTE } from './time'

const day = new Date(2026, 10, 3).getTime() // 3 Nov 2026, local midnight
const next = addDays(day, 1)
let id = 0
const entry = (e: Omit<Entry, 'id'>): Entry => ({ id: String(id++), ...e })

describe('dailyStats', () => {
  it('splits a night sleep across midnight and the night/day boundary', () => {
    // 20:00 → 08:00 next day: 4h night on day 1; 7h night + 1h day on day 2.
    const sleep = entry({ type: 'sleep', start: atHour(day, 20), end: atHour(next, 8) })
    const [d1, d2] = dailyStats([sleep], [day, next], atHour(next, 12))
    expect(d1.nightSleepMs).toBe(4 * HOUR)
    expect(d1.daySleepMs).toBe(0)
    expect(d1.longestSleepMs).toBe(12 * HOUR)
    expect(d2.nightSleepMs).toBe(7 * HOUR)
    expect(d2.daySleepMs).toBe(1 * HOUR)
    expect(d2.tracked).toBe(true)
  })

  it('counts naps that start in the day window and running timers up to now', () => {
    const nap = entry({ type: 'sleep', start: atHour(day, 10) })
    const [s] = dailyStats([nap], [day], atHour(day, 10) + 45 * MINUTE)
    expect(s.naps).toBe(1)
    expect(s.daySleepMs).toBe(45 * MINUTE)
  })

  it('tallies feeds, bottle volume and diapers by the day they started', () => {
    const entries = [
      entry({ type: 'feed', kind: 'breast', side: 'left', start: atHour(day, 7), end: atHour(day, 7) + 20 * MINUTE }),
      entry({ type: 'feed', kind: 'bottle', amountMl: 120, start: atHour(day, 11) }),
      entry({ type: 'feed', kind: 'bottle', amountMl: 90, start: atHour(next, 1) }),
      entry({ type: 'diaper', kind: 'wet', start: atHour(day, 8) }),
      entry({ type: 'diaper', kind: 'mixed', start: atHour(day, 9) }),
    ]
    const [s, n] = dailyStats(entries, [day, next], atHour(next, 12))
    expect(s).toMatchObject({ breast: 1, bottle: 1, bottleMl: 120, breastMs: 20 * MINUTE, wet: 1, mixed: 1 })
    expect(n).toMatchObject({ bottle: 1, bottleMl: 90 })
  })
})

describe('summarize', () => {
  it('averages over tracked days only and counts mixed diapers as wet and dirty', () => {
    const entries = [
      entry({ type: 'diaper', kind: 'mixed', start: atHour(day, 8) }),
      entry({ type: 'diaper', kind: 'wet', start: atHour(day, 9) }),
    ]
    const empty = addDays(day, -1)
    const summary = summarize(dailyStats(entries, [empty, day], atHour(day, 12)))
    expect(summary.trackedDays).toBe(1)
    expect(summary.diapers).toBe(2)
    expect(summary.wet).toBe(2)
    expect(summary.dirty).toBe(1)
  })
})
