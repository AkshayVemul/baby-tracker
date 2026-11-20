import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { nextFeedDue } from './nextFeed'
import { HOUR, MINUTE } from './time'

const t0 = new Date(2026, 10, 18, 9).getTime()
const every3h = { feedIntervalMin: 180, feedIntervalFrom: 'start' as const }

describe('nextFeedDue', () => {
  it('counts from the start of the latest milk feed, ignoring solids', () => {
    const entries: Entry[] = [
      { id: 'a', type: 'feed', kind: 'breast', start: t0, end: t0 + 20 * MINUTE },
      { id: 'b', type: 'feed', kind: 'bottle', start: t0 + 2 * HOUR, end: t0 + 2 * HOUR + 15 * MINUTE },
      { id: 'c', type: 'feed', kind: 'solids', start: t0 + 3 * HOUR, end: t0 + 3 * HOUR + 10 * MINUTE },
    ]
    expect(nextFeedDue(entries, every3h)).toMatchObject({ due: t0 + 5 * HOUR, last: { id: 'b' } })
  })

  it('counts from when a bottle finished when set to "end", not from when it started', () => {
    const entries: Entry[] = [{ id: 'b', type: 'feed', kind: 'bottle', amountMl: 120, start: t0, end: t0 + 25 * MINUTE }]
    expect(nextFeedDue(entries, { feedIntervalMin: 180, feedIntervalFrom: 'end' })?.due).toBe(t0 + 25 * MINUTE + 3 * HOUR)
  })

  it('has nothing to show while a bottle is still going', () => {
    expect(nextFeedDue([{ id: 'b', type: 'feed', kind: 'bottle', start: t0 }], every3h)).toBeNull()
  })

  it('can count from the end of a breastfeed instead', () => {
    const entries: Entry[] = [{ id: 'a', type: 'feed', kind: 'breast', start: t0, end: t0 + 20 * MINUTE }]
    expect(nextFeedDue(entries, { feedIntervalMin: 150, feedIntervalFrom: 'end' })?.due).toBe(t0 + 20 * MINUTE + 150 * MINUTE)
  })

  it('has nothing to show while feeding, with no feeds, or when turned off', () => {
    expect(nextFeedDue([{ id: 'a', type: 'feed', kind: 'breast', start: t0 }], every3h)).toBeNull()
    expect(nextFeedDue([], every3h)).toBeNull()
    expect(nextFeedDue([{ id: 'b', type: 'feed', kind: 'bottle', start: t0, end: t0 }], { ...every3h, feedIntervalMin: 0 })).toBeNull()
  })
})
