import type { Entry, Settings } from '../types'
import { durationMs, hasBreak, kindLabel, MILKS, SIDES } from './entries'
import { formatDuration } from './time'
import { formatMeasure } from './units'

/** One-line detail for a list row, e.g. "Bottle · 120 ml formula" or "Left · 14m". */
export function describe(entry: Entry, settings: Settings, now: number): string {
  const parts: (string | undefined)[] = []
  const side = SIDES.find((s) => s.value === entry.side)?.label
  const milk = MILKS.find((m) => m.value === entry.milk)?.label.toLowerCase()

  switch (entry.type) {
    case 'sleep':
    case 'activity':
      parts.push(kindLabel(entry))
      parts.push(entry.end === undefined ? 'in progress' : formatDuration(durationMs(entry, now)))
      break
    case 'feed':
      parts.push(kindLabel(entry))
      if (entry.kind === 'breast') {
        parts.push(side, timing(entry, now))
      } else if (entry.kind === 'bottle') {
        parts.push(
          [entry.amountMl !== undefined && formatMeasure('volume', entry.amountMl, settings), milk]
            .filter(Boolean)
            .join(' ') || undefined,
          timing(entry, now),
        )
      } else {
        parts.push(entry.food, timing(entry, now))
      }
      break
    case 'diaper':
      parts.push(kindLabel(entry))
      break
    case 'pump':
      parts.push(side, entry.amountMl !== undefined ? formatMeasure('volume', entry.amountMl, settings) : undefined, timing(entry, now))
      break
    case 'growth':
      if (entry.weightKg !== undefined) parts.push(formatMeasure('weight', entry.weightKg, settings))
      if (entry.heightCm !== undefined) parts.push(formatMeasure('length', entry.heightCm, settings))
      if (entry.headCm !== undefined) parts.push(`head ${formatMeasure('length', entry.headCm, settings)}`)
      break
    case 'health':
      parts.push(kindLabel(entry))
      if (entry.tempC !== undefined) parts.push(formatMeasure('temp', entry.tempC, settings))
      parts.push([entry.medicine, entry.dose].filter(Boolean).join(' ') || undefined)
      break
    case 'note':
      break
  }
  return parts.filter(Boolean).join(' · ')
}

/**
 * Breastfeeding/pumping status: "paused" or "in progress" while the timer runs, otherwise the net duration with
 * any break time, e.g. "14m · 2m break". Nothing for an older pump log with no real duration.
 */
function timing(entry: Entry, now: number): string | undefined {
  if (entry.end === undefined) return entry.pausedAt !== undefined ? 'paused' : 'in progress'
  if (entry.end <= entry.start) return undefined
  const breaks = hasBreak(entry) ? ` · ${formatDuration(entry.pausedMs!)} break` : ''
  return formatDuration(durationMs(entry, now)) + breaks
}
