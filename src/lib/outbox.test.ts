import { beforeEach, describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { applyOutbox, enqueue, flush, hasPending, loadOutbox, type Op, type SendResult } from './outbox'

const memory = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as Storage

const entry = (id: string, notes?: string): Entry => ({ id, type: 'note', start: 0, notes })
const ok: SendResult = { error: null, status: 201 }
const offline: SendResult = { error: { message: 'TypeError: Failed to fetch' }, status: 0 }

beforeEach(() => memory.clear())

describe('enqueue', () => {
  it('keeps only the latest change per entry, in order', () => {
    enqueue('h', { type: 'upsert', entry: entry('a', 'first') })
    enqueue('h', { type: 'upsert', entry: entry('b') })
    enqueue('h', { type: 'upsert', entry: entry('a', 'second') })
    enqueue('h', { type: 'delete', id: 'b' })
    const ops = loadOutbox('h')
    expect(ops.map((o) => [o.type, o.type === 'upsert' ? o.entry.notes : o.id])).toEqual([
      ['upsert', 'second'],
      ['delete', 'b'],
    ])
    expect(hasPending('h', 'a')).toBe(true)
    expect(hasPending('other', 'a')).toBe(false)
  })
})

describe('applyOutbox', () => {
  it('lays queued edits, adds and deletes over server data', () => {
    enqueue('h', { type: 'upsert', entry: entry('a', 'edited offline') })
    enqueue('h', { type: 'upsert', entry: entry('new') })
    enqueue('h', { type: 'delete', id: 'gone' })
    const result = applyOutbox([entry('a', 'server'), entry('gone'), entry('kept')], loadOutbox('h'))
    expect(result.map((e) => [e.id, e.notes])).toEqual([
      ['a', 'edited offline'],
      ['kept', undefined],
      ['new', undefined],
    ])
  })
})

describe('flush', () => {
  it('sends everything and empties the queue when online', async () => {
    enqueue('h', { type: 'upsert', entry: entry('a') })
    enqueue('h', { type: 'delete', id: 'b' })
    const sent: Op[] = []
    const result = await flush('h', async (op) => (sent.push(op), ok))
    expect(sent.map((o) => o.type)).toEqual(['upsert', 'delete'])
    expect(result).toEqual({ offline: false, rejected: [] })
    expect(loadOutbox('h')).toEqual([])
  })

  it('stops at the first network failure and keeps the rest queued', async () => {
    enqueue('h', { type: 'upsert', entry: entry('a') })
    enqueue('h', { type: 'upsert', entry: entry('b') })
    const result = await flush('h', async (op) => (op.type === 'upsert' && op.entry.id === 'a' ? ok : offline))
    expect(result.offline).toBe(true)
    expect(loadOutbox('h').map((o) => o.type === 'upsert' && o.entry.id)).toEqual(['b'])
  })

  it('treats an expired session token as retryable, not as a rejection', async () => {
    enqueue('h', { type: 'upsert', entry: entry('a') })
    const result = await flush('h', async () => ({ error: { message: 'JWT expired' }, status: 401 }))
    expect(result.offline).toBe(true)
    expect(loadOutbox('h')).toHaveLength(1)
  })

  it('drops and reports changes the server refuses', async () => {
    enqueue('h', { type: 'upsert', entry: entry('a') })
    const result = await flush('h', async () => ({ error: { message: 'violates row-level security' }, status: 403 }))
    expect(result.offline).toBe(false)
    expect(result.rejected.map((r) => r.message)).toEqual(['violates row-level security'])
    expect(loadOutbox('h')).toEqual([])
  })

  it('keeps a newer change to the same entry queued while an older one is in flight', async () => {
    enqueue('h', { type: 'upsert', entry: entry('a', 'v1') })
    await flush('h', async () => {
      enqueue('h', { type: 'upsert', entry: entry('a', 'v2') })
      return ok
    })
    const ops = loadOutbox('h')
    expect(ops).toHaveLength(1)
    expect(ops[0].type === 'upsert' && ops[0].entry.notes).toBe('v2')
  })
})
