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

export interface Settings {
  babyName: string
  /** yyyy-mm-dd */
  birthDate: string
  volume: VolumeUnit
  weight: WeightUnit
  length: LengthUnit
  temp: TempUnit
}

/** What screens can do to the log; implemented once in App. */
export interface Actions {
  /** Adds the entry, or replaces the one with the same id. */
  save: (entry: Entry) => void
  /** Deletes with an undo toast. */
  remove: (entry: Entry) => void
  /** One-tap log (diaper, timer start…) with an undo toast. */
  log: (entry: Omit<Entry, 'id'>, message: string) => Entry
  /** Opens the form for an existing entry. */
  edit: (entry: Entry) => void
  /** Opens the form for a new entry. */
  create: (type: EntryType, overrides?: Partial<Entry>) => void
}
