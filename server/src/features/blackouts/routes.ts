import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { blackoutInputSchema, ruleBlocks } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { blackoutRules } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { getRules, listSlots } from '../slots/queries.ts'

/** 受付不可ルール（A-04・仕様6章）。既存の予約は消さず、影響する予約数を見せる */
export const blackoutsRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  .get('/', async (c) => {
    const db = createDb(c.env)
    const [rules, list] = await Promise.all([getRules(db), listSlots(db)])
    return c.json({
      rules: rules.map((r) => ({ ...r, affected: list.filter((s) => ruleBlocks(r, s)).reduce((n, s) => n + s.count, 0) })),
      slots: list.map(({ id, date, startTime, endTime }) => ({ id, date, startTime, endTime })),
    })
  })
  .post('/', validate('json', blackoutInputSchema), async (c) => {
    const db = createDb(c.env)
    const r = await db.insert(blackoutRules).values(c.req.valid('json')).run()
    await audit(db, 'admin', c.get('adminId'), 'blackout_create', r.meta.last_row_id)
    return c.json({ ok: true }, 201)
  })
  .delete('/:id', async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    await db.delete(blackoutRules).where(eq(blackoutRules.id, id)).run()
    await audit(db, 'admin', c.get('adminId'), 'blackout_delete', id)
    return c.json({ ok: true })
  })
