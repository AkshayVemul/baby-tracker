import type { Entry, Settings } from '../types'
import { durationMs, TYPES } from './entries'

interface Backup {
  app: 'baby-tracker'
  version: 1
  exportedAt: string
  settings: Settings
  entries: Entry[]
}

export function toBackup(entries: Entry[], settings: Settings): string {
  const backup: Backup = { app: 'baby-tracker', version: 1, exportedAt: new Date().toISOString(), settings, entries }
  return JSON.stringify(backup, null, 2)
}

/** Throws with a readable message when the file isn't a backup from this app. */
export function fromBackup(text: string): { entries: Entry[]; settings?: Settings } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const backup = data as Partial<Backup>
  if (backup?.app !== 'baby-tracker' || !Array.isArray(backup.entries)) {
    throw new Error('That file is not a Baby Tracker backup.')
  }
  const entries = backup.entries.filter(
    (e): e is Entry => typeof e?.id === 'string' && e.type in TYPES && typeof e.start === 'number',
  )
  return { entries, settings: backup.settings }
}

const CSV_COLUMNS = [
  'type', 'kind', 'start', 'end', 'durationMin', 'breakMin', 'side', 'amountMl', 'milk', 'food',
  'weightKg', 'heightCm', 'headCm', 'tempC', 'medicine', 'dose', 'notes',
] as const

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Spreadsheet-friendly export, oldest first, metric units, local ISO-ish times. */
export function toCsv(entries: Entry[]): string {
  const iso = (ms?: number) => (ms === undefined ? undefined : new Date(ms).toLocaleString('sv-SE'))
  const rows = entries
    .toSorted((a, b) => a.start - b.start)
    .map((e) =>
      CSV_COLUMNS.map((col) => {
        if (col === 'start') return csvCell(iso(e.start))
        if (col === 'end') return csvCell(iso(e.end))
        if (col === 'durationMin') return csvCell(e.end === undefined ? undefined : Math.round(durationMs(e, e.end) / 60000))
        if (col === 'breakMin') return csvCell(e.pausedMs ? Math.round(e.pausedMs / 60000) : undefined)
        return csvCell(e[col])
      }).join(','),
    )
  return [CSV_COLUMNS.join(','), ...rows].join('\n')
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
