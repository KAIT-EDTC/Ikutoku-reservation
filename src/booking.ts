import { getRules, getSettings, getSlots, log } from './common.ts'
import { newCode, nowJst, slotState } from './lib.ts'

// Who is booking. A kiosk device follows every reception rule. An admin (proxy booking) skips the
// blackout / period / already-started checks so paper bookings taken during an outage can be entered
// afterwards, and may exceed capacity only when overbook is set.
export type Booker = { type: 'device'; id: number } | { type: 'admin'; id: number; overbook?: boolean }
export type BookingResult = { ok: true; code: string } | { ok: false; reason: 'not_found' | 'invalid_people' | 'unavailable' | 'full' }

const ADMIN_MAX_PEOPLE = 99

// 予約確定: every rule that decides whether a reservation may be created lives here.
export async function book(db: D1Database, { slotId, people, by }: { slotId: number; people: number; by: Booker }): Promise<BookingResult> {
  if (!Number.isInteger(slotId)) return { ok: false, reason: 'not_found' }
  const [s, rules, [slot]] = await Promise.all([getSettings(db), getRules(db), getSlots(db, 's.id = ?', slotId)])
  if (!slot) return { ok: false, reason: 'not_found' }
  const maxPeople = by.type === 'device' ? s.max_people : ADMIN_MAX_PEOPLE
  if (!Number.isInteger(people) || people < 1 || people > maxPeople) return { ok: false, reason: 'invalid_people' }
  if (by.type === 'device') {
    const st = slotState(slot, rules, s)
    if (!st.bookable) return { ok: false, reason: st.mark === '×' ? 'full' : 'unavailable' }
  }
  const overbook = by.type === 'admin' && !!by.overbook

  // F-06: capacity is re-checked inside the INSERT itself. D1 runs each statement atomically
  // against a single writer, so two kiosks racing for the last seat cannot both succeed.
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    try {
      const r = await db.prepare(`INSERT INTO reservations (slot_id, people, code, created_at, created_by_type, created_by_id)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM slots WHERE id = ?1 AND status != 'deleted') AND (?7
          OR (SELECT capacity FROM slots WHERE id = ?1) - (SELECT COALESCE(SUM(people), 0) FROM reservations WHERE slot_id = ?1 AND status = 'active') >= ?2)`)
        .bind(slot.id, people, code, nowJst().iso, by.type, by.id, overbook ? 1 : 0).run()
      if (!r.meta.changes) return { ok: false, reason: 'full' }
      await log(db, by.type, by.id, overbook ? 'reserve_overbook' : 'reserve', r.meta.last_row_id)
      return { ok: true, code }
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e // code collision → retry with a new code
    }
  }
  throw new Error('could not allocate a reservation code')
}
