import type { Entry, EntryType, Segment } from '../types'

export interface Option {
  value: string
  label: string
}

interface TypeConfig {
  label: string
  emoji: string
  /** CSS colour token used for the type's badge. */
  color: string
  kinds?: Option[]
}

export const TYPES: Record<EntryType, TypeConfig> = {
  sleep: { label: 'Sleep', emoji: '😴', color: 'var(--t-sleep)' },
  feed: {
    label: 'Feed',
    emoji: '🍼',
    color: 'var(--t-feed)',
    kinds: [
      { value: 'breast', label: 'Breast' },
      { value: 'bottle', label: 'Bottle' },
      { value: 'solids', label: 'Solids' },
    ],
  },
  diaper: {
    label: 'Diaper',
    emoji: '🧷',
    color: 'var(--t-diaper)',
    kinds: [
      { value: 'wet', label: 'Wet' },
      { value: 'dirty', label: 'Dirty' },
      { value: 'mixed', label: 'Wet + dirty' },
      { value: 'dry', label: 'Dry' },
    ],
  },
  pump: { label: 'Pump', emoji: '🥛', color: 'var(--t-pump)' },
  growth: { label: 'Growth', emoji: '📏', color: 'var(--t-growth)' },
  health: {
    label: 'Health',
    emoji: '🩺',
    color: 'var(--t-health)',
    kinds: [
      { value: 'temperature', label: 'Temperature' },
      { value: 'medicine', label: 'Medicine' },
      { value: 'symptom', label: 'Symptom' },
      { value: 'vaccine', label: 'Vaccine' },
      { value: 'doctor', label: 'Doctor visit' },
    ],
  },
  activity: {
    label: 'Activity',
    emoji: '🧸',
    color: 'var(--t-activity)',
    kinds: [
      { value: 'tummy', label: 'Tummy time' },
      { value: 'bath', label: 'Bath' },
      { value: 'outdoor', label: 'Outdoors' },
      { value: 'play', label: 'Play' },
    ],
  },
  note: { label: 'Note', emoji: '📝', color: 'var(--t-note)' },
  todo: { label: 'To-do', emoji: '✅', color: 'var(--t-note)' },
}

/** The types that make up the log; to-do ticks live on the To-do screen instead. */
export const TYPE_ORDER = (Object.keys(TYPES) as EntryType[]).filter((type) => type !== 'todo')

export const SIDES: Option[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

export const MILKS: Option[] = [
  { value: 'breast', label: 'Breast milk' },
  { value: 'formula', label: 'Formula' },
]

/** Default sub-type for a new entry of this type. */
export function defaultKind(type: EntryType): string | undefined {
  return TYPES[type].kinds?.[0].value
}

export function kindLabel(entry: Entry): string | undefined {
  return TYPES[entry.type].kinds?.find((k) => k.value === entry.kind)?.label
}

/**
 * Entries with a start and an end that can run as a timer: sleep, every kind of feed, pumping, activities.
 * No end yet means the timer is running. Diapers, growth, health and notes are single moments.
 */
export function isTimed(entry: Pick<Entry, 'type' | 'kind'>): boolean {
  return entry.type === 'sleep' || entry.type === 'activity' || entry.type === 'pump' || entry.type === 'feed'
}

/** Feeds and pumping can be paused and have break time taken off. */
export function isPausable(entry: Pick<Entry, 'type' | 'kind'>): boolean {
  return entry.type === 'pump' || entry.type === 'feed'
}

export function isRunning(entry: Entry): boolean {
  return isTimed(entry) && entry.end === undefined
}

/**
 * Time actually spent, in ms: end (or now while running, or the pause start while paused) minus start,
 * minus break time.
 */
export function durationMs(entry: Entry, now: number): number {
  if (!isTimed(entry)) return 0
  const until = entry.end ?? entry.pausedAt ?? now
  return Math.max(0, until - entry.start - (entry.pausedMs ?? 0))
}

/** The entry with its timer paused at `now`. */
export function pause(entry: Entry, now: number): Entry {
  return entry.pausedAt === undefined ? { ...entry, pausedAt: now } : entry
}

/** The last segment changed by `change`; for sessions that switched sides. */
function withLastSegment(segments: Segment[], change: (last: Segment) => Segment): Segment[] {
  return [...segments.slice(0, -1), change(segments[segments.length - 1])]
}

/** The entry running again; the pause just ended counts as break time (for the side in use, too). */
export function resume(entry: Entry, now: number): Entry {
  if (entry.pausedAt === undefined) return entry
  const { pausedAt, ...rest } = entry
  const paused = Math.max(0, now - pausedAt)
  const resumed: Entry = { ...rest, pausedMs: (entry.pausedMs ?? 0) + paused }
  if (entry.segments) {
    resumed.segments = withLastSegment(entry.segments, (last) => ({ ...last, pausedMs: (last.pausedMs ?? 0) + paused }))
  }
  return resumed
}

/** The entry stopped at `now`; stopping while paused counts the open pause as break time. */
export function finish(entry: Entry, now: number): Entry {
  const done: Entry = { ...resume(entry, now), end: now }
  if (done.segments) done.segments = withLastSegment(done.segments, (last) => ({ ...last, end: now }))
  return done
}

/**
 * The same session carrying on with the other side from `now`: one feed with a Left and a Right time, not two
 * entries. The first switch turns the session so far into its first segment.
 */
export function switchSide(entry: Entry, now: number): Entry {
  const current = resume(entry, now)
  const from = current.side === 'right' ? 'right' : 'left'
  const to = from === 'left' ? 'right' : 'left'
  const segments = current.segments ?? [{ side: from, start: current.start, pausedMs: current.pausedMs }]
  return { ...current, side: to, segments: [...withLastSegment(segments, (last) => ({ ...last, end: now })), { side: to, start: now }] }
}

/** Time on one side, minus its breaks; the side in use counts up to now (or the pause). */
function segmentMs(segment: Segment, entry: Entry, now: number): number {
  const until = segment.end ?? entry.end ?? entry.pausedAt ?? now
  return Math.max(0, until - segment.start - (segment.pausedMs ?? 0))
}

/** The part in use (or last used): the side, or the bottle. */
export function currentPart(entry: Entry): Segment['side'] {
  if (entry.segments?.length) return entry.segments[entry.segments.length - 1].side
  return entry.kind === 'bottle' ? 'bottle' : entry.side === 'right' ? 'right' : 'left'
}

/** The whole entry as its parts: its segments, or one part covering all of it. */
function partsOf(entry: Entry): Segment[] {
  if (entry.segments?.length) return entry.segments
  return [{ side: currentPart(entry), start: entry.start, end: entry.end, pausedMs: entry.pausedMs }]
}

/**
 * A feed that finished a moment ago carrying on at `now` with another part: the other side, or a bottle top-up.
 * The minutes in between count as a break, so the feed's total is still the time actually feeding.
 */
export function continueFeed(entry: Entry, part: Segment['side'], now: number): Entry {
  const gap = Math.max(0, now - (entry.end ?? now))
  const open: Entry = { ...entry }
  delete open.end
  return {
    ...open,
    side: part === 'bottle' ? entry.side : part,
    pausedMs: (entry.pausedMs ?? 0) + gap,
    segments: [...partsOf(entry), { side: part, start: now }],
  }
}

/**
 * Two feeds logged separately (say a breastfeed and a bottle top-up after it) as one: the earlier one keeps its id
 * and gets both as parts. Amounts and notes are combined; the gap between them counts as a break.
 */
export function mergeFeeds(earlier: Entry, later: Entry): Entry {
  const gap = Math.max(0, later.start - (earlier.end ?? later.start))
  const notes = [earlier.notes, later.notes].filter(Boolean).join(' · ')
  const amount = (earlier.amountMl ?? 0) + (later.amountMl ?? 0)
  const segments = [...partsOf(earlier), ...partsOf(later)]
  const breastSide = segments.findLast((p) => p.side !== 'bottle')?.side
  const merged: Entry = {
    ...earlier,
    end: later.end,
    pausedAt: later.pausedAt,
    side: (breastSide as Entry['side']) ?? earlier.side,
    pausedMs: (earlier.pausedMs ?? 0) + (later.pausedMs ?? 0) + gap,
    segments,
    milk: later.milk ?? earlier.milk,
    notes: notes || undefined,
    amountMl: amount > 0 ? amount : undefined,
  }
  return JSON.parse(JSON.stringify(merged)) as Entry
}

/** What's wrong with a feed's or pump's parts (in order), if anything; only the last one can still be running. */
export function partsProblem(parts: Segment[]): string | undefined {
  for (const [i, part] of parts.entries()) {
    if (Number.isNaN(part.start) || Number.isNaN(part.end)) return 'Pick a start and an end time for every part.'
    if (part.end == null && i < parts.length - 1) return 'Only the last part can be left without an end time.'
    if (part.end != null && part.end < part.start) return `Part ${i + 1} ends before it starts.`
    const previousEnd = parts[i - 1]?.end
    if (previousEnd != null && part.start < previousEnd) return `Part ${i + 1} starts before part ${i} ends.`
  }
  return undefined
}

/**
 * The entry made of `parts`, as edited by hand: it starts with the first and ends with the last, and the gaps between
 * them count as breaks. A feed's kind follows its first part and its side is the last breast side; a single part is
 * a plain entry again.
 */
export function withParts(entry: Entry, parts: Segment[]): Entry {
  const first = parts[0]
  const last = parts[parts.length - 1]
  const next: Entry = { ...entry, start: first.start, end: last.end ?? undefined }
  if (entry.type === 'feed') {
    next.kind = first.side === 'bottle' ? 'bottle' : 'breast'
    next.side = parts.findLast((p) => p.side !== 'bottle')?.side as Entry['side']
  } else {
    next.side = last.side as Entry['side']
  }
  if (parts.length === 1) {
    delete next.segments
    next.pausedMs = first.pausedMs
  } else {
    const gaps = parts.slice(1).reduce((sum, part, i) => sum + Math.max(0, part.start - (parts[i].end ?? part.start)), 0)
    next.segments = parts
    next.pausedMs = parts.reduce((sum, part) => sum + (part.pausedMs ?? 0), 0) + gaps
  }
  return JSON.parse(JSON.stringify({ ...next, pausedMs: next.pausedMs || undefined })) as Entry
}

/** Time at the breast: the breast parts of a mixed feed, or all of a plain breastfeed. */
export function breastTimeMs(entry: Entry, now: number): number {
  const parts = sideTimes(entry, now)
  if (parts) return parts.filter((p) => p.side !== 'bottle').reduce((sum, p) => sum + p.ms, 0)
  return entry.kind === 'breast' ? durationMs(entry, now) : 0
}

/** Time per side, in the order fed, for a session that switched sides; otherwise null. */
export function sideTimes(entry: Entry, now: number): { side: Segment['side']; ms: number }[] | null {
  if (!entry.segments || entry.segments.length < 2) return null
  const totals = new Map<Segment['side'], number>()
  for (const segment of entry.segments) totals.set(segment.side, (totals.get(segment.side) ?? 0) + segmentMs(segment, entry, now))
  return [...totals].map(([side, ms]) => ({ side, ms }))
}

/** Break time worth showing: at least half a minute, so it doesn't read "0m break". */
export function hasBreak(entry: Entry): boolean {
  return (entry.pausedMs ?? 0) >= 30_000
}

/**
 * Changes the break time by `deltaMs` (more when positive, less when negative), never below zero duration or zero
 * breaks. On a session that switched sides the change goes to the latest side first, so the per-side times still
 * add up to the total.
 */
export function adjustBreaks(entry: Entry, deltaMs: number, now: number): Entry {
  // Less break never goes below the parts' own breaks: gaps between parts aren't feeding time.
  const removable = entry.segments ? entry.segments.reduce((sum, s) => sum + (s.pausedMs ?? 0), 0) : (entry.pausedMs ?? 0)
  const delta = deltaMs > 0 ? Math.min(deltaMs, durationMs(entry, now)) : Math.max(deltaMs, -removable)
  const adjusted: Entry = { ...entry, pausedMs: (entry.pausedMs ?? 0) + delta }
  if (entry.segments) {
    let left = delta
    const segments = [...entry.segments]
    for (let i = segments.length - 1; i >= 0 && left !== 0; i--) {
      const room = left > 0 ? segmentMs(segments[i], entry, now) : -(segments[i].pausedMs ?? 0)
      const step = left > 0 ? Math.min(left, room) : Math.max(left, room)
      segments[i] = { ...segments[i], pausedMs: (segments[i].pausedMs ?? 0) + step }
      left -= step
    }
    adjusted.segments = segments
  }
  return adjusted
}

/** Takes `ms` more break time off a finished session, never below zero duration. */
export function subtractBreak(entry: Entry, ms: number, now: number): Entry {
  return adjustBreaks(entry, ms, now)
}

/** Same start time: whatever ends later is listed first, e.g. a sleep that begins at a bottle's time sits above it. */
export function sortNewestFirst(entries: Entry[]): Entry[] {
  return entries.toSorted((a, b) => b.start - a.start || (b.end ?? b.start) - (a.end ?? a.start))
}

/** Lower-cased text a search box matches against. */
export function searchText(entry: Entry): string {
  return [
    TYPES[entry.type].label,
    kindLabel(entry),
    entry.side,
    ...(entry.segments?.map((s) => s.side) ?? []),
    entry.milk,
    entry.food,
    entry.medicine,
    entry.dose,
    entry.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** A fresh entry for the "add" form; timed types default to a just-finished session. */
export function newEntry(type: EntryType, now: number, overrides: Partial<Entry> = {}): Entry {
  const entry: Entry = { id: crypto.randomUUID(), type, kind: defaultKind(type), start: now, ...overrides }
  if (isTimed(entry) && !('end' in overrides) && !('start' in overrides)) {
    entry.start = now - (type === 'sleep' ? 60 : 15) * 60_000
    entry.end = now
  }
  return entry
}
