import { and, eq, type SQL } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { devices, reservations, slots } from '../../db/schema.ts'

/** 管理画面の予約一覧の行（コマの日時と、作成元の端末名つき） */
export const reservationRows = (db: Db, where: SQL) =>
  db
    .select({
      id: reservations.id,
      slotId: reservations.slotId,
      code: reservations.code,
      people: reservations.people,
      status: reservations.status,
      createdAt: reservations.createdAt,
      createdByType: reservations.createdByType,
      cancelledAt: reservations.cancelledAt,
      deviceName: devices.name,
      date: slots.date,
      startTime: slots.startTime,
      endTime: slots.endTime,
    })
    .from(reservations)
    .innerJoin(slots, eq(slots.id, reservations.slotId))
    .leftJoin(devices, and(eq(reservations.createdByType, 'device'), eq(devices.id, reservations.createdById)))
    .where(where)
    .orderBy(reservations.createdAt)
    .all()
