import { and, eq, sql } from 'drizzle-orm'
import { newCode, nowJst, slotState } from './domain.ts'
import { getRules, getSettings, isUnique, listSlots, log, type DB } from './queries.ts'
import { reservations, slots } from './schema.ts'

// Who is booking. A kiosk device follows every reception rule. An admin (proxy booking) skips the
// blackout / period / already-started checks so paper bookings taken during an outage can be entered
// afterwards, and may exceed capacity only when overbook is set.
export type Booker = { type: 'device'; id: number } | { type: 'admin'; id: number; overbook?: boolean }
export type BookingResult = { ok: true; code: string } | { ok: false; reason: 'not_found' | 'invalid_people' | 'unavailable' | 'full' }

const ADMIN_MAX_PEOPLE = 99

// 予約確定: every rule that decides whether a reservation may be created lives here.
export async function book(db: DB, { slotId, people, by }: { slotId: number; people: number; by: Booker }): Promise<BookingResult> {
  if (!Number.isInteger(slotId)) return { ok: false, reason: 'not_found' }
  const [s, rules, [slot]] = await Promise.all([getSettings(db), getRules(db), listSlots(db, eq(slots.id, slotId))])
  if (!slot) return { ok: false, reason: 'not_found' }
  const maxPeople = by.type === 'device' ? s.maxPeople : ADMIN_MAX_PEOPLE
  if (!Number.isInteger(people) || people < 1 || people > maxPeople) return { ok: false, reason: 'invalid_people' }
  if (by.type === 'device') {
    const st = slotState(slot, rules, s)
    if (!st.bookable) return { ok: false, reason: st.status === 'full' ? 'full' : 'unavailable' }
  }
  const overbook = by.type === 'admin' && !!by.overbook
  const remaining = sql`${slots.capacity} - (SELECT coalesce(sum(people), 0) FROM reservations WHERE slot_id = ${slots.id} AND status = 'active')`

  // F-06: capacity is re-checked inside the INSERT itself. D1 runs each statement atomically
  // against a single writer, so two kiosks racing for the last seat cannot both succeed.
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    try {
      const r = await db.insert(reservations).select(
        db.select({
          id: sql`NULL`.as('id'), slotId: slots.id, people: sql`${people}`.as('people'), code: sql`${code}`.as('code'), status: sql`'active'`.as('status'),
          createdAt: sql`${nowJst().iso}`.as('created_at'), createdByType: sql`${by.type}`.as('created_by_type'),
          createdById: sql`${by.id}`.as('created_by_id'), cancelledAt: sql`NULL`.as('cancelled_at'),
        }).from(slots).where(and(eq(slots.id, slot.id), eq(slots.deleted, false), overbook ? undefined : sql`${remaining} >= ${people}`)),
      ).run()
      if (!r.meta.changes) return { ok: false, reason: 'full' }
      await log(db, by.type, by.id, overbook ? 'reserve_overbook' : 'reserve', r.meta.last_row_id)
      return { ok: true, code }
    } catch (e) {
      if (!isUnique(e)) throw e // code collision → retry with a new code
    }
  }
  throw new Error('could not allocate a reservation code')
}
