import type { Entry } from '../types'
import { breastTimeMs } from './entries'
import { addDays, atHour, overlap } from './time'

/** Sleep between these hours counts as night sleep; the rest are naps. */
export const NIGHT_END_HOUR = 7
export const NIGHT_START_HOUR = 19

export interface DayStats {
  day: number
  /** Anything was logged on this day; averages skip days that weren't tracked. */
  tracked: boolean
  nightSleepMs: number
  daySleepMs: number
  /** Sleeps that started during the day window. */
  naps: number
  /** Longest single sleep that started on this day. */
  longestSleepMs: number
  breast: number
  bottle: number
  solids: number
  breastMs: number
  bottleMl: number
  wet: number
  dirty: number
  mixed: number
  dry: number
  pumpMl: number
}

/**
 * Per-day totals. Sleep is split at midnight and at the night/day boundaries, so a sleep from
 * 20:00 to 06:00 adds 4h to one day and 6h to the next. Counts go to the day an entry started.
 */
export function dailyStats(entries: Entry[], days: number[], now: number): DayStats[] {
  return days.map((day) => {
    const next = addDays(day, 1)
    const dayStart = atHour(day, NIGHT_END_HOUR)
    const dayEnd = atHour(day, NIGHT_START_HOUR)
    const s: DayStats = {
      day,
      tracked: false,
      nightSleepMs: 0,
      daySleepMs: 0,
      naps: 0,
      longestSleepMs: 0,
      breast: 0,
      bottle: 0,
      solids: 0,
      breastMs: 0,
      bottleMl: 0,
      wet: 0,
      dirty: 0,
      mixed: 0,
      dry: 0,
      pumpMl: 0,
    }

    for (const e of entries) {
      const startsToday = e.start >= day && e.start < next

      if (e.type === 'sleep') {
        const end = e.end ?? now
        const total = overlap(e.start, end, day, next)
        if (total === 0 && !startsToday) continue
        const daytime = overlap(e.start, end, dayStart, dayEnd)
        s.daySleepMs += daytime
        s.nightSleepMs += total - daytime
        s.tracked = true
        if (startsToday) {
          s.longestSleepMs = Math.max(s.longestSleepMs, end - e.start)
          if (e.start >= dayStart && e.start < dayEnd) s.naps += 1
        }
        continue
      }

      if (!startsToday) continue
      s.tracked = true
      if (e.type === 'feed') {
        // One feed, counted by how it started; a breastfeed with a bottle top-up is one breast feed, but its
        // bottle amount still adds to the day's bottle total and only the breast parts count as breastfeeding.
        s.breastMs += breastTimeMs(e, now)
        s.bottleMl += e.amountMl ?? 0
        if (e.kind === 'breast') {
          s.breast += 1
        } else if (e.kind === 'bottle') {
          s.bottle += 1
        } else if (e.kind === 'solids') {
          s.solids += 1
        }
      } else if (e.type === 'diaper') {
        if (e.kind === 'wet' || e.kind === 'dirty' || e.kind === 'mixed' || e.kind === 'dry') s[e.kind] += 1
      } else if (e.type === 'pump') {
        s.pumpMl += e.amountMl ?? 0
      }
    }
    return s
  })
}

export interface RangeSummary {
  trackedDays: number
  sleepMs: number
  nightSleepMs: number
  naps: number
  feeds: number
  bottleMl: number
  diapers: number
  wet: number
  dirty: number
  /** Longest single sleep in the whole range. */
  longestSleepMs: number
}

/** Per-day averages over the tracked days, plus the longest sleep. */
export function summarize(stats: DayStats[]): RangeSummary {
  const tracked = stats.filter((s) => s.tracked)
  const n = Math.max(1, tracked.length)
  const avg = (pick: (s: DayStats) => number) => tracked.reduce((sum, s) => sum + pick(s), 0) / n
  return {
    trackedDays: tracked.length,
    sleepMs: avg((s) => s.nightSleepMs + s.daySleepMs),
    nightSleepMs: avg((s) => s.nightSleepMs),
    naps: avg((s) => s.naps),
    feeds: avg((s) => s.breast + s.bottle + s.solids),
    bottleMl: avg((s) => s.bottleMl),
    diapers: avg((s) => s.wet + s.dirty + s.mixed + s.dry),
    wet: avg((s) => s.wet + s.mixed),
    dirty: avg((s) => s.dirty + s.mixed),
    longestSleepMs: Math.max(0, ...stats.map((s) => s.longestSleepMs)),
  }
}

/** Most recent entry matching `test`. */
export function latest(entries: Entry[], test: (e: Entry) => boolean): Entry | undefined {
  let best: Entry | undefined
  for (const e of entries) if (test(e) && (!best || e.start > best.start)) best = e
  return best
}
