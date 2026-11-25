import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { adjustBreaks, bottleTotals, breastTimeMs, continueFeed, currentPart, durationMs, finish, isRunning, mergeFeeds, partsProblem, pause, resume, sideTimes, subtractBreak, switchPart, switchSide, withParts } from './entries'
import { MINUTE } from './time'

const t0 = new Date(2026, 10, 18, 9).getTime()
const feed: Entry = { id: 'a', type: 'feed', kind: 'breast', side: 'left', start: t0 }

describe('pausable timers', () => {
  it('freezes the clock while paused and counts the pause as break time after resuming', () => {
    const paused = pause(feed, t0 + 5 * MINUTE)
    expect(durationMs(paused, t0 + 9 * MINUTE)).toBe(5 * MINUTE)
    expect(isRunning(paused)).toBe(true)

    const resumed = resume(paused, t0 + 8 * MINUTE)
    expect(resumed.pausedAt).toBeUndefined()
    expect(resumed.pausedMs).toBe(3 * MINUTE)
    expect(durationMs(resumed, t0 + 10 * MINUTE)).toBe(7 * MINUTE)
  })

  it('stopping while paused ends the session with the open pause counted as break', () => {
    const done = finish(pause(feed, t0 + 12 * MINUTE), t0 + 14 * MINUTE)
    expect(done).toMatchObject({ end: t0 + 14 * MINUTE, pausedMs: 2 * MINUTE })
    expect(done.pausedAt).toBeUndefined()
    expect(durationMs(done, t0 + 60 * MINUTE)).toBe(12 * MINUTE)
  })

  it('takes break time off a finished session but never below zero', () => {
    const done = finish(feed, t0 + 10 * MINUTE)
    expect(durationMs(subtractBreak(done, 2 * MINUTE, t0), t0)).toBe(8 * MINUTE)
    expect(durationMs(subtractBreak(done, 30 * MINUTE, t0), t0)).toBe(0)
  })

  it('treats a pump log without an end as running and one with end = start as finished', () => {
    expect(isRunning({ id: 'p', type: 'pump', start: t0 })).toBe(true)
    expect(isRunning({ id: 'p', type: 'pump', start: t0, end: t0 })).toBe(false)
  })
})

describe('switching sides', () => {
  const total = (e: Entry, now: number) => (sideTimes(e, now) ?? []).reduce((sum, s) => sum + s.ms, 0)

  it('keeps one entry with a time per side, which add up to the whole feed', () => {
    const switched = switchSide(feed, t0 + 12 * MINUTE)
    expect(switched).toMatchObject({ id: 'a', side: 'right', start: t0 })
    expect(isRunning(switched)).toBe(true)
    const done = finish(switched, t0 + 21 * MINUTE)
    expect(sideTimes(done, t0 + 60 * MINUTE)).toEqual([
      { side: 'left', ms: 12 * MINUTE },
      { side: 'right', ms: 9 * MINUTE },
    ])
    expect(durationMs(done, t0 + 60 * MINUTE)).toBe(21 * MINUTE)
  })

  it('counts a pause against the side it happened on, including one still open when switching or stopping', () => {
    let e = pause(feed, t0 + 5 * MINUTE) // left: 5m fed, then paused
    e = switchSide(e, t0 + 8 * MINUTE) // 3m pause on the left, now on the right
    e = pause(e, t0 + 14 * MINUTE) // right: 6m fed, then paused
    e = finish(e, t0 + 16 * MINUTE) // 2m pause on the right
    const now = t0 + 60 * MINUTE
    expect(sideTimes(e, now)).toEqual([
      { side: 'left', ms: 5 * MINUTE },
      { side: 'right', ms: 6 * MINUTE },
    ])
    expect(e.pausedMs).toBe(5 * MINUTE)
    expect(durationMs(e, now)).toBe(11 * MINUTE)
  })

  it('takes break time off the latest side first, spilling into the earlier one, and can give it back', () => {
    const done = finish(switchSide(feed, t0 + 12 * MINUTE), t0 + 14 * MINUTE) // left 12m, right 2m
    const now = t0 + 60 * MINUTE
    const minus5 = subtractBreak(done, 5 * MINUTE, now)
    expect(sideTimes(minus5, now)).toEqual([
      { side: 'left', ms: 9 * MINUTE },
      { side: 'right', ms: 0 },
    ])
    expect(durationMs(minus5, now)).toBe(total(minus5, now))
    const back = adjustBreaks(minus5, -4 * MINUTE, now)
    expect(durationMs(back, now)).toBe(13 * MINUTE)
    expect(total(back, now)).toBe(13 * MINUTE)
  })

  it('leaves a single-side session as before', () => {
    expect(sideTimes(finish(feed, t0 + 10 * MINUTE), t0)).toBeNull()
  })
})

describe('bottle top-ups', () => {
  const now = t0 + 2 * 60 * MINUTE

  it('carries a just-finished breastfeed on with a bottle, the gap counting as a break', () => {
    const breastfed = finish(switchSide(feed, t0 + 10 * MINUTE), t0 + 18 * MINUTE) // left 10m, right 8m
    const topUp = continueFeed(breastfed, 'bottle', t0 + 21 * MINUTE) // 3 minutes later
    expect(isRunning(topUp)).toBe(true)
    expect(currentPart(topUp)).toBe('bottle')
    expect(topUp.side).toBe('right') // still the last breast side, for "next side"
    const done = { ...finish(topUp, t0 + 29 * MINUTE), amountMl: 60 }
    expect(sideTimes(done, now)).toEqual([
      { side: 'left', ms: 10 * MINUTE },
      { side: 'right', ms: 8 * MINUTE },
      { side: 'bottle', ms: 8 * MINUTE },
    ])
    expect(durationMs(done, now)).toBe(26 * MINUTE)
    expect(breastTimeMs(done, now)).toBe(18 * MINUTE)
  })

  it('merges a separately logged bottle into the breastfeed before it', () => {
    const breastfed = finish(feed, t0 + 15 * MINUTE)
    const bottle: Entry = { id: 'b', type: 'feed', kind: 'bottle', milk: 'formula', amountMl: 60, start: t0 + 20 * MINUTE, end: t0 + 28 * MINUTE, notes: 'sleepy' }
    const merged = mergeFeeds({ ...breastfed, notes: 'good latch' }, bottle)
    expect(merged).toMatchObject({ id: 'a', kind: 'breast', side: 'left', start: t0, end: t0 + 28 * MINUTE, amountMl: 60, milk: 'formula', notes: 'good latch · sleepy' })
    expect(sideTimes(merged, now)).toEqual([
      { side: 'left', ms: 15 * MINUTE },
      { side: 'bottle', ms: 8 * MINUTE },
    ])
    expect(durationMs(merged, now)).toBe(23 * MINUTE)
  })

  it('remembers the side the merged feed last used, so the next feed starts on the other one', () => {
    const bothSides = finish(switchSide(feed, t0 + 10 * MINUTE), t0 + 20 * MINUTE)
    const bottle: Entry = { id: 'b', type: 'feed', kind: 'bottle', amountMl: 60, start: t0 + 25 * MINUTE, end: t0 + 30 * MINUTE }
    expect(mergeFeeds(bothSides, bottle).side).toBe('right')
  })
})

describe('editing parts by hand', () => {
  const left = { side: 'left' as const, start: t0, end: t0 + 10 * MINUTE }
  const right = { side: 'right' as const, start: t0 + 12 * MINUTE, end: t0 + 20 * MINUTE, pausedMs: MINUTE }
  const bottle = { side: 'bottle' as const, start: t0 + 25 * MINUTE, end: t0 + 30 * MINUTE }

  it('spans the parts, with the gaps between them as breaks', () => {
    const fed = withParts({ id: 'a', type: 'feed', kind: 'breast', start: 0 }, [left, right, bottle])
    expect(fed).toMatchObject({ kind: 'breast', side: 'right', start: t0, end: t0 + 30 * MINUTE, pausedMs: 8 * MINUTE })
    expect(durationMs(fed, t0)).toBe(22 * MINUTE)
    expect(breastTimeMs(fed, t0)).toBe(17 * MINUTE)
  })

  it('a feed that starts with the bottle is a bottle feed, and a single part is a plain entry again', () => {
    expect(withParts({ id: 'a', type: 'feed', start: 0 }, [bottle, { ...left, start: t0 + 31 * MINUTE, end: t0 + 40 * MINUTE }])).toMatchObject({ kind: 'bottle', side: 'left' })
    const single = withParts({ id: 'a', type: 'pump', start: 0, segments: [left, right], pausedMs: 3 * MINUTE }, [right])
    expect(single).toEqual({ id: 'a', type: 'pump', side: 'right', start: t0 + 12 * MINUTE, end: t0 + 20 * MINUTE, pausedMs: MINUTE })
  })

  it('reports parts that overlap, run backwards or are missing an end', () => {
    expect(partsProblem([left, right])).toBeUndefined()
    expect(partsProblem([left, { ...right, start: t0 + 5 * MINUTE }])).toBe('Part 2 starts before part 1 ends.')
    expect(partsProblem([{ ...left, end: t0 - MINUTE }])).toBe('Part 1 ends before it starts.')
    expect(partsProblem([{ side: 'left', start: t0 }, right])).toBe('Only the last part can be left without an end time.')
    expect(partsProblem([left, { side: 'right', start: t0 + 12 * MINUTE }])).toBeUndefined()
    expect(partsProblem([left, { ...right, end: Number.NaN }])).toBe('Pick a start and an end time for every part.')
  })
})

describe('switching parts while feeding', () => {
  it('goes from the bottle to the breast and back to another bottle, in one feed', () => {
    const bottle: Entry = { id: 'b', type: 'feed', kind: 'bottle', milk: 'breast', start: t0 }
    const toLeft = switchPart(bottle, 'left', t0 + 10 * MINUTE)
    expect(toLeft).toMatchObject({ kind: 'bottle', side: 'left' })
    expect(toLeft.segments).toEqual([
      { side: 'bottle', start: t0, end: t0 + 10 * MINUTE, milk: 'breast' },
      { side: 'left', start: t0 + 10 * MINUTE },
    ])
    const formula = switchPart(toLeft, 'bottle', t0 + 20 * MINUTE, { milk: 'formula' })
    expect(formula.side).toBe('left')
    expect(formula.segments?.at(-1)).toEqual({ side: 'bottle', start: t0 + 20 * MINUTE, milk: 'formula' })
    expect(sideTimes(finish(formula, t0 + 25 * MINUTE), t0)).toEqual([
      { side: 'bottle', ms: 15 * MINUTE },
      { side: 'left', ms: 10 * MINUTE },
    ])
  })

  it('adds up the bottles and keeps the milk only when they all had the same', () => {
    const expressed = { side: 'bottle' as const, start: t0, end: t0 + 5 * MINUTE, amountMl: 60, milk: 'breast' as const }
    const formula = { side: 'bottle' as const, start: t0 + 5 * MINUTE, end: t0 + 9 * MINUTE, amountMl: 30, milk: 'formula' as const }
    expect(bottleTotals([expressed, formula])).toEqual({ amountMl: 90, milk: undefined })
    expect(bottleTotals([expressed, { ...expressed, amountMl: 40 }])).toEqual({ amountMl: 100, milk: 'breast' })
    expect(withParts({ id: 'a', type: 'feed', start: 0 }, [expressed, formula])).toMatchObject({ kind: 'bottle', amountMl: 90 })
    expect(partsProblem([expressed, { ...formula, amountMl: Number.NaN }])).toBe('Part 2’s amount must be a positive number.')
  })
})
