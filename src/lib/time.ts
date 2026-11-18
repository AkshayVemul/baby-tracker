import type { TimeFormat } from '../types'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Local midnight `days` days after `dayStart`; DST-safe, unlike adding 24h. */
export function addDays(dayStart: number, days: number): number {
  const d = new Date(dayStart)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

/** Local `hour`:00 on the day starting at `dayStart`. */
export function atHour(dayStart: number, hour: number): number {
  const d = new Date(dayStart)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime()
}

/** The last `count` day starts, oldest first, ending with today. */
export function lastDays(count: number, now: number): number[] {
  const today = startOfDay(now)
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1))
}

/** Milliseconds two intervals share. */
export function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/** 3725000 -> "1:02:05", 75000 -> "1:15" */
export function formatClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = String(sec % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 5400000 -> "1h 30m", 45000 -> "0m" */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MINUTE))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** "just now", "12m ago", "2h 5m ago" */
export function formatAgo(ms: number, now: number): string {
  const diff = now - ms
  if (diff < MINUTE) return 'just now'
  return `${formatDuration(diff)} ago`
}

/** "9:05 PM" or "21:05". */
export function formatTime(ms: number, format: TimeFormat): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: format === '12h' })
}

/** "Today", "Yesterday", "Mon 3 Nov" */
export function formatDay(dayStart: number, now: number): string {
  const today = startOfDay(now)
  if (dayStart === today) return 'Today'
  if (dayStart === addDays(today, -1)) return 'Yesterday'
  return new Date(dayStart).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "3 Nov" — compact axis label. */
export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/** Value for `<input type="datetime-local">`. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Value for `<input type="date">`. */
export function toDateInput(ms: number): string {
  return toLocalInput(ms).slice(0, 10)
}

/** Parses `datetime-local` / `date` input values as local time; NaN when empty. */
export function fromLocalInput(value: string): number {
  if (!value) return Number.NaN
  return new Date(value.length === 10 ? `${value}T00:00` : value).getTime()
}

/** "3 months, 2 weeks" from a yyyy-mm-dd birth date. */
export function formatAge(birthDate: string, now: number): string {
  const birth = fromLocalInput(birthDate)
  if (Number.isNaN(birth) || birth > now) return ''
  const days = Math.floor((startOfDay(now) - startOfDay(birth)) / (24 * HOUR) + 0.5)
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} old`
  const b = new Date(birth)
  const n = new Date(now)
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth()
  if (n.getDate() < b.getDate()) months -= 1
  if (months < 2) return `${Math.floor(days / 7)} weeks old`
  const years = Math.floor(months / 12)
  if (years < 2) {
    const rest = new Date(b.getFullYear(), b.getMonth() + months, b.getDate()).getTime()
    const weeks = Math.floor((startOfDay(now) - rest) / (7 * 24 * HOUR))
    return weeks > 0 ? `${months} months, ${weeks} ${weeks === 1 ? 'week' : 'weeks'} old` : `${months} months old`
  }
  const m = months % 12
  return m > 0 ? `${years} years, ${m} months old` : `${years} years old`
}
