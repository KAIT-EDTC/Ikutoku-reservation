import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { nowJst, slotState } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { slots } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { validate } from '../../lib/validator.ts'
import { eventDates, getRules, getSettings, listSlots } from '../slots/queries.ts'

/** 空き状況（F-01）。閲覧のみで、予約はできない。日付を省くと今日以降の最初の日。非公開の間は何も返さない */
export const publicRoute = new Hono<AppEnv>().get('/', validate('query', z.object({ date: z.iso.date().optional() })), async (c) => {
  const db = createDb(c.env)
  const [s, rules] = await Promise.all([getSettings(db), getRules(db)])
  if (!s.published) return c.json({ published: false, notice: '', dates: [], date: null, slots: [] })
  const dates = await eventDates(db, s)
  const date = c.req.valid('query').date ?? dates.find((d) => d >= nowJst().date) ?? dates[0] ?? null
  const list = date ? await listSlots(db, eq(slots.date, date)) : []
  return c.json({
    published: true,
    notice: s.notice,
    dates,
    date,
    slots: list.map((sl) => ({ id: sl.id, startTime: sl.startTime, endTime: sl.endTime, ...slotState(sl, rules, s) })),
  })
})
