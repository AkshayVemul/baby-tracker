import type { Entry, EntryType } from '../types'
import { supabase } from './supabase'

export interface Household {
  id: string
  baby_name: string
  /** yyyy-mm-dd or null */
  birth_date: string | null
  invite_code: string
}

/** A row of `public.entries`; nullable columns are the optional Entry fields. */
export interface EntryRow {
  id: string
  household_id: string
  type: EntryType
  start_at: string
  end_at: string | null
  kind: string | null
  side: Entry['side'] | null
  amount_ml: number | null
  milk: Entry['milk'] | null
  food: string | null
  weight_kg: number | null
  height_cm: number | null
  head_cm: number | null
  temp_c: number | null
  medicine: string | null
  dose: string | null
  notes: string | null
}

const PAGE = 1000

/** Entry fields that map one-to-one onto a snake_case column. */
const FIELDS = {
  kind: 'kind',
  side: 'side',
  amountMl: 'amount_ml',
  milk: 'milk',
  food: 'food',
  weightKg: 'weight_kg',
  heightCm: 'height_cm',
  headCm: 'head_cm',
  tempC: 'temp_c',
  medicine: 'medicine',
  dose: 'dose',
  notes: 'notes',
} as const satisfies Partial<Record<keyof Entry, keyof EntryRow>>

export function toRow(entry: Entry, householdId: string): EntryRow {
  const row = {
    id: entry.id,
    household_id: householdId,
    type: entry.type,
    start_at: new Date(entry.start).toISOString(),
    end_at: entry.end === undefined ? null : new Date(entry.end).toISOString(),
  } as EntryRow
  for (const [field, column] of Object.entries(FIELDS)) {
    ;(row as unknown as Record<string, unknown>)[column] = entry[field as keyof typeof FIELDS] ?? null
  }
  return row
}

export function fromRow(row: EntryRow): Entry {
  const entry: Entry = { id: row.id, type: row.type, start: Date.parse(row.start_at) }
  if (row.end_at) entry.end = Date.parse(row.end_at)
  for (const [field, column] of Object.entries(FIELDS)) {
    const value = row[column]
    if (value !== null && value !== undefined) (entry as unknown as Record<string, unknown>)[field] = value
  }
  return entry
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data
}

/** The first household the signed-in user belongs to, or null before they create or join one. */
export async function fetchMyHousehold(): Promise<Household | null> {
  const rows = check(
    await supabase.from('households').select('id, baby_name, birth_date, invite_code').order('created_at').limit(1),
  )
  return rows?.[0] ?? null
}

export async function createHousehold(babyName: string, birthDate: string): Promise<Household> {
  return check(await supabase.rpc('create_household', { baby_name: babyName, birth_date: birthDate || null }))
}

export async function joinHousehold(code: string): Promise<Household> {
  return check(await supabase.rpc('join_household', { code }))
}

export async function updateHousehold(id: string, changes: Partial<Pick<Household, 'baby_name' | 'birth_date'>>) {
  check(await supabase.from('households').update(changes).eq('id', id))
}

/** All entries, paged past PostgREST's 1000-row response limit. */
export async function fetchEntries(householdId: string): Promise<Entry[]> {
  const entries: Entry[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await supabase
        .from('entries')
        .select('*')
        .eq('household_id', householdId)
        .order('start_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1),
    ) as EntryRow[]
    entries.push(...rows.map(fromRow))
    if (rows.length < PAGE) return entries
  }
}

export async function saveEntries(entries: Entry[], householdId: string) {
  for (let i = 0; i < entries.length; i += 500) {
    const rows = entries.slice(i, i + 500).map((e) => toRow(e, householdId))
    check(await supabase.from('entries').upsert(rows))
  }
}

export async function deleteEntry(id: string) {
  check(await supabase.from('entries').delete().eq('id', id))
}

export async function deleteAllEntries(householdId: string) {
  check(await supabase.from('entries').delete().eq('household_id', householdId))
}
