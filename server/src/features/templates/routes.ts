import { and, eq, notExists, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { templateInputSchema } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { reservations, slots, slotTemplates } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { generateSlots } from '../slots/queries.ts'

/** コマのひな形（A-02）。追加すると受付期間内の該当曜日にコマを作る */
export const templatesRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  .get('/', async (c) =>
    c.json({ templates: await createDb(c.env).select().from(slotTemplates).orderBy(slotTemplates.weekday, slotTemplates.startTime).all() }),
  )
  .post('/', validate('json', templateInputSchema), async (c) => {
    const db = createDb(c.env)
    const r = await db.insert(slotTemplates).values(c.req.valid('json')).run()
    await generateSlots(db)
    await audit(db, 'admin', c.get('adminId'), 'template_create', r.meta.last_row_id)
    return c.json({ ok: true }, 201)
  })
  // 予約が1件もないコマは一緒に消す。予約のあるコマは残り、外部キーで template_id が外れる
  .delete('/:id', async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    const anyReservation = db.select({ x: sql`1` }).from(reservations).where(eq(reservations.slotId, slots.id))
    await db.batch([
      db.delete(slots).where(and(eq(slots.templateId, id), notExists(anyReservation))),
      db.delete(slotTemplates).where(eq(slotTemplates.id, id)),
    ])
    await audit(db, 'admin', c.get('adminId'), 'template_delete', id)
    return c.json({ ok: true })
  })
