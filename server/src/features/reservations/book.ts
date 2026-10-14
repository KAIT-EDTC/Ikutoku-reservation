import { and, eq, sql } from 'drizzle-orm'
import { nowJst, slotState } from '@ikutoku/shared'
import { isUniqueViolation, type Db } from '../../db/index.ts'
import { reservations, slots } from '../../db/schema.ts'
import { audit } from '../../lib/audit.ts'
import { getSettings, listSlots } from '../slots/queries.ts'

/**
 * 予約する人。受付端末はすべての受付ルールに従う。管理者（代理予約）は、停止中に紙で受けた予約を後から入れられるよう
 * 受付期間・開始済みの判定を飛ばし、overbook のときだけ定員を超えられる
 */
export type Booker = { type: 'device'; id: number } | { type: 'admin'; id: number; overbook?: boolean }
export type BookingResult = { ok: true; code: string } | { ok: false; reason: 'not_found' | 'invalid_people' | 'unavailable' | 'full' }

const ADMIN_MAX_PEOPLE = 99

// 見間違えやすい 0/O, 1/I/L は使わない（仕様7章）
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const newCode = (len = 4) =>
  [...crypto.getRandomValues(new Uint8Array(len))].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')

/** 予約確定: 予約を作ってよいかの判定はすべてここにある */
export async function book(db: Db, { slotId, people, by }: { slotId: number; people: number; by: Booker }): Promise<BookingResult> {
  if (!Number.isInteger(slotId)) return { ok: false, reason: 'not_found' }
  const [s, [slot]] = await Promise.all([getSettings(db), listSlots(db, eq(slots.id, slotId))])
  if (!slot) return { ok: false, reason: 'not_found' }
  const maxPeople = by.type === 'device' ? s.maxPeople : ADMIN_MAX_PEOPLE
  if (!Number.isInteger(people) || people < 1 || people > maxPeople) return { ok: false, reason: 'invalid_people' }
  if (by.type === 'device') {
    const st = slotState(slot, s)
    if (!st.bookable) return { ok: false, reason: st.status === 'full' ? 'full' : 'unavailable' }
  }
  const overbook = by.type === 'admin' && !!by.overbook
  const remaining = sql`${slots.capacity} - (SELECT coalesce(sum(people), 0) FROM reservations WHERE slot_id = ${slots.id} AND status = 'active')`

  // F-06: 定員の再判定を INSERT 文そのものに入れる。D1 は1文ずつ単一の書き込みで実行するので、
  // 2台が最後の1枠を同時に取り合っても両方は通らない
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    try {
      const r = await db
        .insert(reservations)
        .select(
          db
            .select({
              id: sql`NULL`.as('id'),
              slotId: slots.id,
              people: sql`${people}`.as('people'),
              code: sql`${code}`.as('code'),
              status: sql`'active'`.as('status'),
              createdAt: sql`${nowJst().iso}`.as('created_at'),
              createdByType: sql`${by.type}`.as('created_by_type'),
              createdById: sql`${by.id}`.as('created_by_id'),
              cancelledAt: sql`NULL`.as('cancelled_at'),
            })
            .from(slots)
            .where(and(eq(slots.id, slot.id), eq(slots.deleted, false), overbook ? undefined : sql`${remaining} >= ${people}`)),
        )
        .run()
      if (!r.meta.changes) return { ok: false, reason: 'full' }
      await audit(db, by.type, by.id, overbook ? 'reserve_overbook' : 'reserve', r.meta.last_row_id)
      return { ok: true, code }
    } catch (e) {
      if (!isUniqueViolation(e)) throw e // 予約番号の衝突 → 番号を変えてやり直す
    }
  }
  throw new Error('予約番号を割り当てられませんでした')
}
