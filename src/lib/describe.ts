import type { Entry, Settings } from '../types'
import { durationMs, hasBreak, kindLabel, MILKS, sideTimes, SIDES } from './entries'
import { formatDuration } from './time'
import { formatMeasure } from './units'

/** One-line detail for a list row, e.g. "Bottle · 120 ml formula" or "Left · 14m". */
export function describe(entry: Entry, settings: Settings, now: number): string {
  const parts: (string | undefined)[] = []
  const side = SIDES.find((s) => s.value === entry.side)?.label

  switch (entry.type) {
    case 'sleep':
    case 'activity':
      parts.push(kindLabel(entry))
      parts.push(entry.end === undefined ? 'in progress' : formatDuration(durationMs(entry, now)))
      break
    case 'feed':
      if (entry.segments?.length) {
        // A feed in parts (sides, bottles) is described by its parts: each one's time, then what was in the bottles.
        parts.push(...sidesAndTiming(entry, side, now), bottlesText(entry, settings))
      } else if (entry.kind === 'breast') {
        parts.push(kindLabel(entry), ...sidesAndTiming(entry, side, now), bottlesText(entry, settings))
      } else if (entry.kind === 'bottle') {
        parts.push(kindLabel(entry), bottlesText(entry, settings), timing(entry, now))
      } else {
        parts.push(kindLabel(entry), entry.food, timing(entry, now))
      }
      break
    case 'diaper':
      parts.push(kindLabel(entry))
      break
    case 'pump':
      parts.push(...sidesAndTiming(entry, side, now), entry.amountMl !== undefined ? formatMeasure('volume', entry.amountMl, settings) : undefined)
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
 * What was in the bottles: "60 ml expressed milk + 30 ml formula" when the bottle parts have their own amounts,
 * otherwise the feed's amount and milk, e.g. "120 ml formula".
 */
function bottlesText(entry: Entry, settings: Settings): string | undefined {
  const label = (amountMl: number | undefined, milk: Entry['milk']) =>
    [amountMl !== undefined && formatMeasure('volume', amountMl, settings), amountMl !== undefined && MILKS.find((m) => m.value === milk)?.label.toLowerCase()]
      .filter(Boolean)
      .join(' ') || undefined
  const bottles = entry.segments?.filter((part) => part.side === 'bottle' && part.amountMl !== undefined) ?? []
  if (bottles.length > 0) return bottles.map((part) => label(part.amountMl, part.milk)).join(' + ')
  return label(entry.amountMl, entry.milk)
}

/**
 * Breastfeeding/pumping status: "paused" or "in progress" while the timer runs, otherwise the net duration with
 * any break time, e.g. "14m · 2m break". Nothing for an older pump log with no real duration.
 */
/** "Left 12m + Right 9m", for a session that switched sides; otherwise undefined. */
export function sidesText(entry: Entry, now: number): string | undefined {
  return sideTimes(entry, now)
    ?.map(({ side, ms }) => `${side === 'left' ? 'Left' : side === 'right' ? 'Right' : 'Bottle'} ${formatDuration(ms)}`)
    .join(' + ')
}

/** The side and duration, or for a session that switched sides the time per side (plus status or breaks). */
function sidesAndTiming(entry: Entry, side: string | undefined, now: number): (string | undefined)[] {
  const sides = sidesText(entry, now)
  if (!sides) return [side, timing(entry, now)]
  if (entry.end === undefined) return [sides, entry.pausedAt !== undefined ? 'paused' : 'in progress']
  return [sides, hasBreak(entry) ? `${formatDuration(entry.pausedMs!)} break` : undefined]
}

function timing(entry: Entry, now: number): string | undefined {
  if (entry.end === undefined) return entry.pausedAt !== undefined ? 'paused' : 'in progress'
  if (entry.end <= entry.start) return undefined
  const breaks = hasBreak(entry) ? ` · ${formatDuration(entry.pausedMs!)} break` : ''
  return formatDuration(durationMs(entry, now)) + breaks
}
