import { nowJst, weekday } from './date.ts'

export type Settings = { openDate: string; closeDate: string; maxPeople: number; resetSeconds: number; notice: string; published: boolean }
export type BlackoutKind = 'once' | 'weekly' | 'monthly' | 'slot'
export type Rule = {
  id: number
  kind: BlackoutKind
  dateFrom: string | null
  dateTo: string | null
  weekday: number | null
  nth: number | null
  timeFrom: string | null
  timeTo: string | null
  slotId: number | null
  memo: string
}
export type Slot = { id: number; date: string; startTime: string; endTime: string; capacity: number; booked: number }
export type SlotStatus = 'ok' | 'few' | 'full' | 'stopped' | 'ended'

/** 公開ページの記号（仕様 F-01） */
export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = { ok: '○', few: '△', full: '×', stopped: '受付停止', ended: '終了' }

/** 受付不可ルールがこのコマにかかるか。時間帯が空なら終日 */
export function ruleBlocks(rule: Rule, slot: Pick<Slot, 'id' | 'date' | 'startTime' | 'endTime'>) {
  if (rule.kind === 'slot') return rule.slotId === slot.id
  const d = slot.date
  if (rule.kind === 'once' && !(rule.dateFrom! <= d && d <= rule.dateTo!)) return false
  if (rule.kind === 'weekly' && weekday(d) !== rule.weekday) return false
  if (rule.kind === 'monthly' && (weekday(d) !== rule.weekday || Math.ceil(+d.slice(8, 10) / 7) !== rule.nth)) return false
  if (rule.timeFrom && rule.timeTo) return slot.startTime < rule.timeTo && rule.timeFrom < slot.endTime
  return true
}

/** 判定順は仕様6章: 受付不可 > 受付期間・開始済み > 残数 */
export function slotState(slot: Slot, rules: Rule[], s: Pick<Settings, 'openDate' | 'closeDate'>, now = nowJst()) {
  const remaining = Math.max(0, slot.capacity - slot.booked)
  const status: SlotStatus =
    rules.some((r) => ruleBlocks(r, slot)) || slot.date < s.openDate || slot.date > s.closeDate ? 'stopped'
    : slot.date < now.date || (slot.date === now.date && slot.startTime <= now.time) ? 'ended'
    : remaining <= 0 ? 'full'
    : remaining <= Math.max(2, slot.capacity * 0.3) ? 'few'
    : 'ok'
  return { status, remaining, bookable: status === 'ok' || status === 'few' }
}
