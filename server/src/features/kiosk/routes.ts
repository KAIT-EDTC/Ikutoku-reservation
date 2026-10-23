import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { nowJst, reserveSchema, slotState } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { slots } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { badRequest, conflict } from '../../lib/errors.ts'
import { validate } from '../../lib/validator.ts'
import { requireDevice } from '../../middleware/auth.ts'
import { book } from '../reservations/book.ts'
import { eventDates, getSettings, listSlots } from '../slots/queries.ts'

/** 受付端末（登録済みの端末だけ）。予約の作成のみで、取消はできない（F-04） */
export const kioskRoute = new Hono<AppEnv>()
  .use(requireDevice)
  // 受付画面に必要なもの全部: 設定・予約できる日付・date を指定したらその日のコマ
  .get('/', validate('query', z.object({ date: z.iso.date().optional() })), async (c) => {
    const db = createDb(c.env)
    const { date } = c.req.valid('query')
    const s = await getSettings(db)
    const [dates, list] = await Promise.all([eventDates(db, s), date ? listSlots(db, eq(slots.date, date)) : []])
    return c.json({
      notice: s.notice,
      maxPeople: s.maxPeople,
      resetSeconds: s.resetSeconds,
      dates: dates.filter((d) => d >= nowJst().date),
      slots: list.map((sl) => ({ id: sl.id, date: sl.date, product: sl.product, startTime: sl.startTime, endTime: sl.endTime, ...slotState(sl, s) })),
    })
  })
  .post('/reservations', validate('json', reserveSchema), async (c) => {
    const { slotId, people } = c.req.valid('json')
    const db = createDb(c.env)
    const r = await book(db, { slotId, people, by: { type: 'device', id: c.get('deviceId') } })
    if (!r.ok) {
      if (r.reason === 'full') throw conflict('直前に他の方の予約が入り、定員に達しました。')
      if (r.reason === 'unavailable') throw conflict('このコマは受付を停止しました。')
      throw badRequest('選択内容が正しくありません。')
    }
    const slot = (await db.select().from(slots).where(eq(slots.id, slotId)).get())!
    return c.json({ code: r.code, people, date: slot.date, product: slot.product, startTime: slot.startTime, endTime: slot.endTime }, 201)
  })
