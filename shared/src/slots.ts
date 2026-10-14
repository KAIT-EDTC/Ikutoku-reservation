import { nowJst } from './date.ts'

export type Settings = { openDate: string; closeDate: string; maxPeople: number; resetSeconds: number; notice: string; published: boolean }
export type Slot = { id: number; date: string; startTime: string; endTime: string; capacity: number; booked: number }
export type SlotStatus = 'ok' | 'few' | 'full' | 'stopped' | 'ended'

/** 公開ページの記号（仕様 F-01） */
export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = { ok: '○', few: '△', full: '×', stopped: '受付停止', ended: '終了' }

/** 判定順: 受付期間外 > 開始済み > 残数。満員になったコマは予約できない */
export function slotState(slot: Slot, s: Pick<Settings, 'openDate' | 'closeDate'>, now = nowJst()) {
  const remaining = Math.max(0, slot.capacity - slot.booked)
  const status: SlotStatus =
    slot.date < s.openDate || slot.date > s.closeDate ? 'stopped'
    : slot.date < now.date || (slot.date === now.date && slot.startTime <= now.time) ? 'ended'
    : remaining <= 0 ? 'full'
    : remaining <= Math.max(2, slot.capacity * 0.3) ? 'few'
    : 'ok'
  return { status, remaining, bookable: status === 'ok' || status === 'few' }
}
