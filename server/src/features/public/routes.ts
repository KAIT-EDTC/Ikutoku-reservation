import { between } from 'drizzle-orm'
import { Hono } from 'hono'
import { slotState } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { slots } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { eventDates, getSettings, listSlots } from '../slots/queries.ts'

/** 空き状況（F-01）。閲覧のみで、予約はできない。受付期間の全日・全体験のコマを返す（開催は2日間なので少ない）。非公開の間は何も返さない */
export const publicRoute = new Hono<AppEnv>().get('/', async (c) => {
  const db = createDb(c.env)
  const s = await getSettings(db)
  if (!s.published) return c.json({ published: false, notice: '', dates: [], slots: [] })
  const [dates, list] = await Promise.all([eventDates(db, s), listSlots(db, between(slots.date, s.openDate, s.closeDate))])
  return c.json({
    published: true,
    notice: s.notice,
    dates,
    slots: list.map((sl) => ({ id: sl.id, date: sl.date, product: sl.product, startTime: sl.startTime, endTime: sl.endTime, ...slotState(sl, s) })),
  })
})
