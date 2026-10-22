import { and, between, eq, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { reservations, settings, slots } from '../../db/schema.ts'

export const getSettings = async (db: Db) => (await db.select().from(settings).where(eq(settings.id, 1)).get())!

/** 削除されていないコマと、有効な予約の人数合計(booked)・件数(count) */
export const listSlots = (db: Db, where?: SQL) =>
  db
    .select({
      id: slots.id,
      date: slots.date,
      startTime: slots.startTime,
      endTime: slots.endTime,
      capacity: slots.capacity,
      booked: sql<number>`coalesce(sum(${reservations.people}), 0)`.mapWith(Number),
      count: sql<number>`count(${reservations.id})`.mapWith(Number),
    })
    .from(slots)
    .leftJoin(reservations, and(eq(reservations.slotId, slots.id), eq(reservations.status, 'active')))
    .where(and(eq(slots.deleted, false), where))
    .groupBy(slots.id)
    .orderBy(slots.date, slots.startTime)
    .all()

/** 受付期間内で、コマが1つ以上ある日付 */
export const eventDates = async (db: Db, s: { openDate: string; closeDate: string }) =>
  (
    await db
      .selectDistinct({ date: slots.date })
      .from(slots)
      .where(and(eq(slots.deleted, false), between(slots.date, s.openDate, s.closeDate)))
      .orderBy(slots.date)
      .all()
  ).map((r) => r.date)
