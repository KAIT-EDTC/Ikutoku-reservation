import { and, eq, like, notExists, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { slotInputSchema, slotState, slotStopSchema, slotUpdateSchema } from '@ikutoku/shared'
import { createDb, isUniqueViolation } from '../../db/index.ts'
import { blackoutRules, reservations, slots } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { conflict } from '../../lib/errors.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { reservationRows } from '../reservations/queries.ts'
import { getRules, getSettings, listSlots } from './queries.ts'

const SLOT_TAKEN = 'その開始時刻のコマは既にあります'

export const slotsRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  // 日別: コマごとの状態と予約一覧（今日の予約・カレンダーの日付ページ）
  .get('/', validate('query', z.object({ date: z.iso.date() })), async (c) => {
    const db = createDb(c.env)
    const { date } = c.req.valid('query')
    const [s, rules, list, rows] = await Promise.all([
      getSettings(db),
      getRules(db),
      listSlots(db, eq(slots.date, date)),
      reservationRows(db, eq(slots.date, date)),
    ])
    return c.json({
      slots: list.map((sl) => ({
        ...sl,
        ...slotState(sl, rules, s),
        /** 「特定コマのみ」の受付不可ルールで止めているか */
        stopped: rules.some((r) => r.kind === 'slot' && r.slotId === sl.id),
        reservations: rows.filter((r) => r.slotId === sl.id),
      })),
    })
  })
  // 月表示: 日ごとのコマ数・定員・予約人数
  .get('/calendar', validate('query', z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() })), async (c) => {
    const db = createDb(c.env)
    const s = await getSettings(db)
    const month = c.req.valid('query').month ?? s.openDate.slice(0, 7)
    const days: Record<string, { slots: number; capacity: number; booked: number }> = {}
    for (const sl of await listSlots(db, like(slots.date, `${month}-%`))) {
      const d = (days[sl.date] ??= { slots: 0, capacity: 0, booked: 0 })
      d.slots += 1
      d.capacity += sl.capacity
      d.booked += sl.booked
    }
    return c.json({ month, openDate: s.openDate, closeDate: s.closeDate, days })
  })
  .post('/', validate('json', slotInputSchema), async (c) => {
    const db = createDb(c.env)
    const v = c.req.valid('json')
    // 削除済みの同じ開始時刻があれば、その行を復活させる
    const r = await db
      .insert(slots)
      .values(v)
      .onConflictDoUpdate({ target: [slots.date, slots.startTime], set: { endTime: v.endTime, capacity: v.capacity, deleted: false }, setWhere: eq(slots.deleted, true) })
      .run()
    if (!r.meta.changes) throw conflict(SLOT_TAKEN)
    await audit(db, 'admin', c.get('adminId'), 'slot_create', r.meta.last_row_id)
    return c.json({ ok: true }, 201)
  })
  .put('/:id', validate('json', slotUpdateSchema), async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    try {
      await db.update(slots).set(c.req.valid('json')).where(and(eq(slots.id, id), eq(slots.deleted, false))).run()
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict(SLOT_TAKEN)
      throw e
    }
    await audit(db, 'admin', c.get('adminId'), 'slot_update', id)
    return c.json({ ok: true })
  })
  // 有効な予約があるコマは消せない（既存予約は消さない: 仕様6章）
  .delete('/:id', async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    const active = db.select({ x: sql`1` }).from(reservations).where(and(eq(reservations.slotId, id), eq(reservations.status, 'active')))
    const r = await db.update(slots).set({ deleted: true }).where(and(eq(slots.id, id), notExists(active))).run()
    if (!r.meta.changes) throw conflict('有効な予約があるコマは削除できません。先に予約を取り消すか、コマを受付停止にしてください。')
    await audit(db, 'admin', c.get('adminId'), 'slot_delete', id)
    return c.json({ ok: true })
  })
  // 1コマだけ止める = 「特定コマのみ」の受付不可ルール（仕様6章）を付け外しする
  .post('/:id/stop', validate('json', slotStopSchema), async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    const { stopped } = c.req.valid('json')
    const where = and(eq(blackoutRules.kind, 'slot'), eq(blackoutRules.slotId, id))
    if (!stopped) await db.delete(blackoutRules).where(where).run()
    else if (!(await db.$count(blackoutRules, where))) await db.insert(blackoutRules).values({ kind: 'slot', slotId: id }).run()
    await audit(db, 'admin', c.get('adminId'), stopped ? 'slot_stop' : 'slot_resume', id)
    return c.json({ ok: true })
  })
