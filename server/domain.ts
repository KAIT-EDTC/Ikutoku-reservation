// Pure logic shared by the worker, the web app and the tests (no Workers/Hono imports here).
import type { blackoutRules, settings } from './schema.ts'

export type Settings = typeof settings.$inferSelect
export type Rule = typeof blackoutRules.$inferSelect
export type Slot = { id: number; date: string; startTime: string; endTime: string; capacity: number; booked: number }
export type SlotStatus = 'ok' | 'few' | 'full' | 'stopped' | 'ended'

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// Current Asia/Tokyo time as { date: 'YYYY-MM-DD', time: 'HH:MM' }. JST has no DST.
export function nowJst(ms = Date.now()) {
  const iso = new Date(ms + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), iso: iso.slice(0, 19).replace('T', ' ') }
}

export const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

export function addDays(date: string, n: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)
}

export function datesBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 366; d = addDays(d, 1)) out.push(d)
  return out
}

export const fmtDate = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}(${WEEKDAYS[weekday(date)]})`

// Does a blackout rule cover this slot? A null time range means all day.
export function ruleBlocks(rule: Rule, slot: Pick<Slot, 'id' | 'date' | 'startTime' | 'endTime'>) {
  if (rule.kind === 'slot') return rule.slotId === slot.id
  const d = slot.date
  if (rule.kind === 'once' && !(rule.dateFrom! <= d && d <= rule.dateTo!)) return false
  if (rule.kind === 'weekly' && weekday(d) !== rule.weekday) return false
  if (rule.kind === 'monthly' && (weekday(d) !== rule.weekday || Math.ceil(+d.slice(8, 10) / 7) !== rule.nth)) return false
  if (rule.timeFrom && rule.timeTo) return slot.startTime < rule.timeTo && rule.timeFrom < slot.endTime
  return true
}

// Judging order follows the spec §6: blackout > period/past > capacity.
export function slotState(slot: Slot, rules: Rule[], s: Settings, now = nowJst()) {
  const remaining = Math.max(0, slot.capacity - slot.booked)
  const status: SlotStatus =
    rules.some((r) => ruleBlocks(r, slot)) || slot.date < s.openDate || slot.date > s.closeDate ? 'stopped'
    : slot.date < now.date || (slot.date === now.date && slot.startTime <= now.time) ? 'ended'
    : remaining <= 0 ? 'full'
    : remaining <= Math.max(2, slot.capacity * 0.3) ? 'few'
    : 'ok'
  return { status, remaining, bookable: status === 'ok' || status === 'few' }
}

// No 0/O, 1/I/L to avoid misreading.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function newCode(len = 4) {
  return [...crypto.getRandomValues(new Uint8Array(len))].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}
