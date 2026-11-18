import type { Entry, EntryType } from '../types'

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
}

export const TYPE_ORDER = Object.keys(TYPES) as EntryType[]

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

/** Entries that have a start and an end: sleep, breastfeeding, activities. */
export function isTimed(entry: Pick<Entry, 'type' | 'kind'>): boolean {
  return (
    entry.type === 'sleep' ||
    entry.type === 'activity' ||
    (entry.type === 'feed' && entry.kind === 'breast')
  )
}

export function isRunning(entry: Entry): boolean {
  return isTimed(entry) && entry.end === undefined
}

/** Duration in ms; a running timer counts up to `now`. */
export function durationMs(entry: Entry, now: number): number {
  if (!isTimed(entry)) return 0
  return Math.max(0, (entry.end ?? now) - entry.start)
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
