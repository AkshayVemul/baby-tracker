import type { Entry, Settings } from '../types'

const ENTRIES_KEY = 'baby-tracker.entries.v1'
const SETTINGS_KEY = 'baby-tracker.settings.v1'

export const defaultSettings: Settings = {
  babyName: '',
  birthDate: '',
  volume: 'ml',
  weight: 'kg',
  length: 'cm',
  temp: 'C',
}

export function newId(): string {
  return crypto.randomUUID()
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
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
