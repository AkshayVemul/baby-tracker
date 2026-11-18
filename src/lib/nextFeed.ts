import type { Entry, Settings } from '../types'
import { isRunning } from './entries'
import { latest } from './stats'
import { MINUTE } from './time'

export interface NextFeed {
  /** When the next feed is due (epoch ms). */
  due: number
  /** The feed it's counted from. */
  last: Entry
}

/**
 * When the next milk feed is due: the last breast or bottle feed plus the interval from Settings, counted from
 * that feed's start or end. Solids don't reset the clock. None while a feed is in progress or the interval is off.
 */
export function nextFeedDue(entries: Entry[], settings: Pick<Settings, 'feedIntervalMin' | 'feedIntervalFrom'>): NextFeed | null {
  if (settings.feedIntervalMin <= 0) return null
  const last = latest(entries, (e) => e.type === 'feed' && e.kind !== 'solids')
  if (!last || isRunning(last)) return null
  const base = settings.feedIntervalFrom === 'end' ? (last.end ?? last.start) : last.start
  return { due: base + settings.feedIntervalMin * MINUTE, last }
}
