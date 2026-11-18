import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { fromRow, toRow } from './db'

describe('entry ↔ row mapping', () => {
  it('round-trips every field and keeps a running timer open', () => {
    const entries: Entry[] = [
      { id: 'a', type: 'feed', kind: 'breast', side: 'left', start: 1_700_000_000_000 },
      { id: 'b', type: 'feed', kind: 'bottle', milk: 'formula', amountMl: 120, start: 1_700_000_100_000, notes: 'hi' },
      { id: 'c', type: 'growth', weightKg: 5.2, heightCm: 58, headCm: 39, start: 1_700_000_200_000 },
      { id: 'd', type: 'health', kind: 'medicine', medicine: 'Paracetamol', dose: '2.5 ml', tempC: 38.1, start: 1 },
      { id: 'e', type: 'sleep', start: 1_700_000_000_000, end: 1_700_003_600_000 },
    ]
    for (const entry of entries) expect(fromRow(toRow(entry, 'h'))).toEqual(entry)
  })

  it('writes missing fields as nulls so an edit can clear them', () => {
    const row = toRow({ id: 'a', type: 'note', start: 0 }, 'h')
    expect(row).toMatchObject({ household_id: 'h', end_at: null, notes: null, amount_ml: null, start_at: '1970-01-01T00:00:00.000Z' })
  })
})
