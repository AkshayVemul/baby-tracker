import type { Entry, Settings } from '../types'
import type { Household } from './db'

const ENTRIES_KEY = 'baby-tracker.entries.v1'
const SETTINGS_KEY = 'baby-tracker.settings.v1'

export const defaultSettings: Settings = {
  babyName: '',
  birthDate: '',
  volume: 'ml',
  weight: 'kg',
  length: 'cm',
  temp: 'C',
  timeFormat: '12h',
}

export function newId(): string {
  return crypto.randomUUID()
}

export function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or quota: the app still works for this session, it just won't remember.
  }
}

/** Entries saved on this device before the app moved to Supabase; Settings offers to upload them. */
export function loadLocalEntries(): Entry[] {
  const stored = read<Entry[]>(ENTRIES_KEY)
  return Array.isArray(stored) ? stored : []
}

export function clearLocalEntries(): void {
  try {
    localStorage.removeItem(ENTRIES_KEY)
  } catch {
    // Nothing to clear.
  }
}

export function loadSettings(): Settings {
  return { ...defaultSettings, ...read<Partial<Settings>>(SETTINGS_KEY) }
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings)
}

/*
 * Offline copies. The app starts from these (so it opens without a connection) and refreshes them from Supabase.
 * Keyed by household or user so two accounts on one phone never see each other's data.
 */
const CACHE_PREFIX = 'baby-tracker.cache.'
const HOUSEHOLD_PREFIX = 'baby-tracker.household.'
export const OUTBOX_PREFIX = 'baby-tracker.outbox.'

export function loadCachedEntries(householdId: string): Entry[] | null {
  const stored = read<Entry[]>(CACHE_PREFIX + householdId)
  return Array.isArray(stored) ? stored : null
}

export function saveCachedEntries(householdId: string, entries: Entry[]): void {
  write(CACHE_PREFIX + householdId, entries)
}

export function loadCachedHousehold(userId: string): Household | null {
  return read<Household>(HOUSEHOLD_PREFIX + userId)
}

export function saveCachedHousehold(userId: string, household: Household): void {
  write(HOUSEHOLD_PREFIX + userId, household)
}

/** Removes every offline copy and queued change; used when signing out. */
export function clearOfflineData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if ([CACHE_PREFIX, HOUSEHOLD_PREFIX, OUTBOX_PREFIX].some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage unavailable: nothing was cached.
  }
}
