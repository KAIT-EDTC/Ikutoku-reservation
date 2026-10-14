import { and, between, eq, sql, type SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { datesBetween, nowJst, weekday } from './domain.ts'
import { auditLogs, blackoutRules, reservations, settings, slots, slotTemplates } from './schema.ts'

export const orm = (d1: D1Database) => drizzle(d1)
export type DB = ReturnType<typeof orm>
export const isUnique = (e: unknown) => String((e as Error)?.cause ?? e).includes('UNIQUE')

export const getSettings = async (db: DB) => (await db.select().from(settings).where(eq(settings.id, 1)).get())!
export const getRules = (db: DB) => db.select().from(blackoutRules).all()

// Live slots with their active booking totals (people) and counts (reservations).
export const listSlots = (db: DB, where?: SQL) =>
  db.select({
    id: slots.id, date: slots.date, startTime: slots.startTime, endTime: slots.endTime, capacity: slots.capacity,
    booked: sql<number>`coalesce(sum(${reservations.people}), 0)`.mapWith(Number),
    count: sql<number>`count(${reservations.id})`.mapWith(Number),
  })
    .from(slots)
    .leftJoin(reservations, and(eq(reservations.slotId, slots.id), eq(reservations.status, 'active')))
    .where(and(eq(slots.deleted, false), where))
    .groupBy(slots.id)
    .orderBy(slots.date, slots.startTime)
    .all()

// Dates in the reception period that have at least one slot.
export const eventDates = async (db: DB, s: { openDate: string; closeDate: string }) =>
  (await db.selectDistinct({ date: slots.date }).from(slots)
    .where(and(eq(slots.deleted, false), between(slots.date, s.openDate, s.closeDate))).orderBy(slots.date).all()).map((r) => r.date)

export const log = (db: DB, actorType: 'device' | 'admin' | 'anonymous', actorId: number | null, action: string, targetId: number | null = null) =>
  db.insert(auditLogs).values({ at: nowJst().iso, actorType, actorId, action, targetId }).run()

// Creates the template slots for every date in the reception period; existing (or soft-deleted) ones are left alone.
export async function generateSlots(db: DB) {
  const [s, ts] = await Promise.all([getSettings(db), db.select().from(slotTemplates).all()])
  const rows = datesBetween(s.openDate, s.closeDate).flatMap((d) =>
    ts.filter((t) => t.weekday === weekday(d) && (!t.validFrom || t.validFrom <= d) && (!t.validTo || d <= t.validTo))
      .map((t) => ({ date: d, startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, templateId: t.id })))
  // D1 caps bound parameters per statement, so insert in small chunks within one batch.
  const chunks = Array.from({ length: Math.ceil(rows.length / 10) }, (_, i) => db.insert(slots).values(rows.slice(i * 10, i * 10 + 10)).onConflictDoNothing())
  if (chunks.length) await db.batch(chunks as [typeof chunks[0], ...typeof chunks])
}
