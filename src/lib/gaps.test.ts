import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { sleepGaps } from './gaps'
import { HOUR, MINUTE } from './time'

const t0 = new Date(2026, 10, 18, 9).getTime()
const feed = (id: string, start: number, end?: number): Entry => ({ id, type: 'feed', kind: end ? 'breast' : 'bottle', start, end })
const sleep = (start: number, end?: number): Entry => ({ id: `s${start}`, type: 'sleep', start, end })

describe('sleepGaps', () => {
  it('runs from the end of a breastfeed, or the time of a bottle, to the next feed', () => {
    const entries = [
      feed('a', t0, t0 + 20 * MINUTE),
      feed('b', t0 + 3 * HOUR),
      feed('c', t0 + 5 * HOUR),
      { id: 'd', type: 'diaper', kind: 'wet', start: t0 + HOUR } as Entry,
    ]
    const gaps = sleepGaps(entries, t0 + 6 * HOUR)
    expect(gaps.get('a')).toEqual({ start: t0 + 20 * MINUTE, end: t0 + 3 * HOUR })
    expect(gaps.get('b')).toEqual({ start: t0 + 3 * HOUR, end: t0 + 5 * HOUR })
    // Nothing after the latest feed.
    expect(gaps.has('c')).toBe(false)
  })

  it('skips gaps that already have a sleep in them, including a running one', () => {
    const entries = [feed('a', t0), feed('b', t0 + 2 * HOUR), feed('c', t0 + 4 * HOUR), sleep(t0 + 30 * MINUTE, t0 + HOUR), sleep(t0 + 3 * HOUR)]
    const gaps = sleepGaps(entries, t0 + 3.5 * HOUR)
    expect([...gaps.keys()]).toEqual([])
  })

  it('skips short gaps and a feed that is still running', () => {
    const entries = [feed('a', t0), feed('b', t0 + 10 * MINUTE), { id: 'c', type: 'feed', kind: 'breast', start: t0 + HOUR } as Entry, feed('d', t0 + 2 * HOUR)]
    expect([...sleepGaps(entries, t0 + HOUR).keys()]).toEqual(['b'])
  })
})
