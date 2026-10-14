import { and, between, eq, sql, type SQL } from 'drizzle-orm'
import { datesBetween, weekday } from '@ikutoku/shared'
import type { Db } from '../../db/index.ts'
import { blackoutRules, reservations, settings, slots, slotTemplates } from '../../db/schema.ts'

export const getSettings = async (db: Db) => (await db.select().from(settings).where(eq(settings.id, 1)).get())!
export const getRules = (db: Db) => db.select().from(blackoutRules).all()

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

/** 受付期間の各日に、ひな形のコマを作る。既にある（削除済みを含む）コマはそのまま */
export async function generateSlots(db: Db) {
  const [s, templates] = await Promise.all([getSettings(db), db.select().from(slotTemplates).all()])
  const rows = datesBetween(s.openDate, s.closeDate).flatMap((d) =>
    templates
      .filter((t) => t.weekday === weekday(d) && (!t.validFrom || t.validFrom <= d) && (!t.validTo || d <= t.validTo))
      .map((t) => ({ date: d, startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, templateId: t.id })),
  )
  // D1 は1文あたりのバインド数に上限があるので、10行ずつに分けて1回のバッチで送る
  const chunks = Array.from({ length: Math.ceil(rows.length / 10) }, (_, i) =>
    db.insert(slots).values(rows.slice(i * 10, i * 10 + 10)).onConflictDoNothing(),
  )
  if (chunks.length) await db.batch(chunks as [(typeof chunks)[0], ...typeof chunks])
}
