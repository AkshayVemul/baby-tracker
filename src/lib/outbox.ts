import type { Entry } from '../types'
import { OUTBOX_PREFIX, read, write } from './storage'

/**
 * Changes waiting to reach Supabase. Every save or delete goes here first, so logging works with no
 * connection; `flush` sends them in order once the network is back. Both kinds are idempotent on the
 * server (upsert by the app-generated id, delete by id), so sending one twice is harmless.
 */
export type Op = { seq: number; type: 'upsert'; entry: Entry } | { seq: number; type: 'delete'; id: string }

/** What sending one change returned: a PostgREST error and HTTP status, or neither on success. */
export interface SendResult {
  error: { message: string } | null
  status: number
}

export interface FlushResult {
  /** Stopped early because the network or server isn't reachable; the rest stays queued. */
  offline: boolean
  /** Changes the server refused (e.g. no longer in the household); dropped from the queue. */
  rejected: { op: Op; message: string }[]
}

const key = (householdId: string) => OUTBOX_PREFIX + householdId
const targetId = (op: Op) => (op.type === 'upsert' ? op.entry.id : op.id)

let lastSeq = 0
const nextSeq = () => (lastSeq = Math.max(lastSeq + 1, Date.now()))

export function loadOutbox(householdId: string): Op[] {
  const stored = read<Op[]>(key(householdId))
  return Array.isArray(stored) ? stored : []
}

function saveOutbox(householdId: string, ops: Op[]): void {
  write(key(householdId), ops)
}

/** Queues a change. A newer change to the same entry replaces the older one; only the final state matters. */
export function enqueue(householdId: string, change: { type: 'upsert'; entry: Entry } | { type: 'delete'; id: string }): void {
  const op = { ...change, seq: nextSeq() } as Op
  const ops = loadOutbox(householdId).filter((o) => targetId(o) !== targetId(op))
  saveOutbox(householdId, [...ops, op])
}

export function clearOutbox(householdId: string): void {
  saveOutbox(householdId, [])
}

export function hasPending(householdId: string, entryId: string): boolean {
  return loadOutbox(householdId).some((o) => targetId(o) === entryId)
}

/** Server data with the queued changes laid on top, so offline edits survive a refetch. */
export function applyOutbox(entries: Entry[], ops: Op[]): Entry[] {
  const byId = new Map(entries.map((e) => [e.id, e]))
  for (const op of ops) {
    if (op.type === 'upsert') byId.set(op.entry.id, op.entry)
    else byId.delete(op.id)
  }
  return [...byId.values()]
}

/** Network down (0), session token expired (401), timeouts, rate limits and server errors are worth retrying. */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500
}

/**
 * Sends queued changes oldest first. Each one leaves the queue only after the server answers, and is
 * removed by its `seq`, so a change queued for the same entry while this one was in flight still goes out.
 */
export async function flush(householdId: string, send: (op: Op) => Promise<SendResult>): Promise<FlushResult> {
  const rejected: FlushResult['rejected'] = []
  for (const op of loadOutbox(householdId)) {
    const { error, status } = await send(op)
    if (error && isRetryable(status)) return { offline: true, rejected }
    if (error) rejected.push({ op, message: error.message })
    saveOutbox(householdId, loadOutbox(householdId).filter((o) => o.seq !== op.seq))
  }
  return { offline: false, rejected }
}
