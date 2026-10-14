import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { adminReserveSchema, nowJst } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { reservations } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { badRequest, conflict } from '../../lib/errors.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { book } from './book.ts'
import { reservationRows } from './queries.ts'

export const reservationsRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  // 予約番号で検索（当日の照合・取消の依頼）
  .get('/', validate('query', z.object({ code: z.string() })), async (c) => {
    const [found] = await reservationRows(createDb(c.env), eq(reservations.code, c.req.valid('query').code.trim().toUpperCase()))
    return c.json({ found: found ?? null })
  })
  // 代理予約（A-07）
  .post('/', validate('json', adminReserveSchema), async (c) => {
    const { slotId, people, overbook } = c.req.valid('json')
    const r = await book(createDb(c.env), { slotId, people, by: { type: 'admin', id: c.get('adminId'), overbook } })
    if (!r.ok) {
      if (r.reason === 'full') throw conflict('定員を超えるため登録できません。必要なら「定員超過を許可」にチェックしてください。')
      throw badRequest('入力内容が正しくありません')
    }
    return c.json({ code: r.code, people }, 201)
  })
  .post('/:id/cancel', async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    const r = await db
      .update(reservations)
      .set({ status: 'cancelled', cancelledAt: nowJst().iso })
      .where(and(eq(reservations.id, id), eq(reservations.status, 'active')))
      .run()
    if (r.meta.changes) await audit(db, 'admin', c.get('adminId'), 'cancel', id)
    return c.json({ ok: true })
  })
