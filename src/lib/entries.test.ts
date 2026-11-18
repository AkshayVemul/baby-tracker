import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { durationMs, finish, isRunning, pause, resume, subtractBreak } from './entries'
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
