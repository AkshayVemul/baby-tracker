/**
 * One part of a feed or pump session with more than one: a side, or a bottle (e.g. a top-up after breastfeeding).
 * Epoch ms; `end` is missing on the part in use.
 */
export interface Segment {
  side: 'left' | 'right' | 'bottle'
  start: number
  end?: number | null
  /** Break time taken off this side. */
  pausedMs?: number
}

export type EntryType = 'sleep' | 'feed' | 'diaper' | 'pump' | 'growth' | 'health' | 'activity' | 'note'

/**
 * One logged event. All types share this flat shape so a single form can edit any of them;
 * each type only uses the fields that make sense for it (see `TYPES` in lib/entries.ts).
 * Measurements are always stored metric and converted for display.
 */
export interface Entry {
  id: string
  type: EntryType
  /** Epoch ms. */
  start: number
  /** Epoch ms. Missing on a timed entry means its timer is still running. */
  end?: number
  /** Breastfeeding/pumping: time not spent feeding (pauses, unlatching), taken off the duration. Ms. */
  pausedMs?: number
  /** Epoch ms. Set while a running timer is paused: when the current pause began. */
  pausedAt?: number
  /**
   * Only on a session with more than one part (sides, or breast then bottle): each part in order. `side` is the
   * last breast side used, and `pausedMs` is the segments' break time plus any gaps between parts.
   */
  segments?: Segment[]
  /** Sub-type: feed breast/bottle/solids, diaper wet/dirty/mixed/dry, health temperature/medicine… */
  kind?: string
  side?: 'left' | 'right' | 'both'
  /** Bottle or pump volume. */
  amountMl?: number
  /** What was in the bottle. */
  milk?: 'breast' | 'formula'
  food?: string
  weightKg?: number
  heightCm?: number
  headCm?: number
  tempC?: number
  medicine?: string
  dose?: string
  notes?: string
}

export type VolumeUnit = 'ml' | 'oz'
export type WeightUnit = 'kg' | 'lb'
export type LengthUnit = 'cm' | 'in'
export type TempUnit = 'C' | 'F'
export type TimeFormat = '12h' | '24h'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  babyName: string
  /** yyyy-mm-dd */
  birthDate: string
  volume: VolumeUnit
  weight: WeightUnit
  length: LengthUnit
  temp: TempUnit
  timeFormat: TimeFormat
  /** Per device. */
  theme: Theme
  /** Minutes between feeds for the "Next feed" line on Today; 0 turns it off. */
  feedIntervalMin: number
  /** Count the interval from the start or the end of the last feed. */
  feedIntervalFrom: 'start' | 'end'
}

/** What screens can do to the log; implemented once in App. */
export interface Actions {
  /** Adds the entry, or replaces the one with the same id. */
  save: (entry: Entry) => void
  /** Deletes with an undo toast. */
  remove: (entry: Entry) => void
  /** One-tap log (diaper, timer start…) with an undo toast. */
  log: (entry: Omit<Entry, 'id'>, message: string) => Entry
  /** Saves a changed entry with an undo toast that puts `previous` back (e.g. a feed carried on with a top-up). */
  change: (entry: Entry, previous: Entry, message: string) => void
  /** Opens the form for an existing entry. */
  edit: (entry: Entry) => void
  /** Opens the form for a new entry. */
  create: (type: EntryType, overrides?: Partial<Entry>) => void
}
