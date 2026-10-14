import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { nowJst, slotState } from '../domain.ts'
import { valid, type Env } from '../http.ts'
import { eventDates, getRules, getSettings, listSlots } from '../queries.ts'
import { slots } from '../schema.ts'

// Read-only availability (F-01). One endpoint serves /, /day/:date and /news.
export default new Hono<Env>().get('/', valid('query', z.object({ date: z.iso.date().optional() })), async (c) => {
  const db = c.var.db
  const [s, rules] = await Promise.all([getSettings(db), getRules(db)])
  const dates = await eventDates(db, s)
  const date = c.req.valid('query').date ?? dates.find((d) => d >= nowJst().date) ?? dates[0] ?? null
  const list = date ? await listSlots(db, eq(slots.date, date)) : []
  return c.json({
    notice: s.notice, dates, date,
    slots: list.map((sl) => ({ id: sl.id, startTime: sl.startTime, endTime: sl.endTime, ...slotState(sl, rules, s) })),
  })
})
