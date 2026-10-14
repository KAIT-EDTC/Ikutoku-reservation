import { and, eq } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { Hono } from 'hono'
import { z } from 'zod'
import { sha256 } from '../auth.ts'
import { book } from '../booking.ts'
import { nowJst, slotState } from '../domain.ts'
import { fail, valid, type Env } from '../http.ts'
import { eventDates, getRules, getSettings, listSlots } from '../queries.ts'
import { devices, slots } from '../schema.ts'

const WHY = { full: '直前に他の方の予約が入り、定員に達しました。', unavailable: 'このコマは受付を停止しました。', not_found: '選択内容が正しくありません。', invalid_people: '選択内容が正しくありません。' }

// Registered devices only (cookie set from /admin/devices).
export default new Hono<Env>()
  .use(async (c, next) => {
    const token = getCookie(c, 'dev')
    const dev = token ? await c.var.db.select({ id: devices.id }).from(devices).where(and(eq(devices.tokenHash, await sha256(token)), eq(devices.active, true))).get() : undefined
    if (!dev) fail(401, '受付端末として登録されていません。')
    c.set('deviceId', dev!.id)
    await next()
  })
  // Everything the kiosk screens need: settings, bookable dates, and the slots of `date` when given.
  .get('/', valid('query', z.object({ date: z.iso.date().optional() })), async (c) => {
    const db = c.var.db
    const { date } = c.req.valid('query')
    const [s, rules] = await Promise.all([getSettings(db), getRules(db)])
    const [dates, list] = await Promise.all([eventDates(db, s), date ? listSlots(db, eq(slots.date, date)) : []])
    return c.json({
      notice: s.notice, maxPeople: s.maxPeople, resetSeconds: s.resetSeconds,
      dates: dates.filter((d) => d >= nowJst().date),
      slots: list.map((sl) => ({ id: sl.id, date: sl.date, startTime: sl.startTime, endTime: sl.endTime, ...slotState(sl, rules, s) })),
    })
  })
  .post('/reserve', valid('json', z.object({ slotId: z.number(), people: z.number() })), async (c) => {
    const { slotId, people } = c.req.valid('json')
    const db = c.var.db
    const r = await book(db, { slotId, people, by: { type: 'device', id: c.get('deviceId') } })
    if (!r.ok) return fail(409, WHY[r.reason])
    const sl = (await db.select().from(slots).where(eq(slots.id, slotId)).get())!
    return c.json({ code: r.code, people, date: sl.date, startTime: sl.startTime, endTime: sl.endTime })
  })
