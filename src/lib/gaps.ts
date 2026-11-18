import type { Entry } from '../types'
import { isRunning } from './entries'
import { MINUTE, overlap } from './time'

export interface Gap {
  start: number
  end: number
}

/** Shorter gaps aren't offered: there's no real sleep to fill. */
export const MIN_GAP_MS = 15 * MINUTE

/**
 * The time between each pair of back-to-back feeds where no sleep is logged, keyed by the earlier feed's id.
 * The gap runs from the end of that feed (its start for a bottle or solids) to the start of the next one.
 * It's offered as a one-tap sleep entry, which the user can then edit like any other.
 */
export function sleepGaps(entries: Entry[], now: number): Map<string, Gap> {
  const feeds = entries.filter((e) => e.type === 'feed').toSorted((a, b) => a.start - b.start)
  const sleeps = entries.filter((e) => e.type === 'sleep')
  const gaps = new Map<string, Gap>()
  for (let i = 0; i < feeds.length - 1; i++) {
    const earlier = feeds[i]
    if (isRunning(earlier)) continue
    const start = earlier.end ?? earlier.start
    const end = feeds[i + 1].start
    if (end - start < MIN_GAP_MS) continue
    if (sleeps.some((s) => overlap(s.start, s.end ?? now, start, end) > 0)) continue
    gaps.set(earlier.id, { start, end })
  }
  return gaps
}
