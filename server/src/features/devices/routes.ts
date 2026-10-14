import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { deviceActiveSchema, deviceNameSchema, nowJst } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { devices } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { randomToken, sha256 } from '../../lib/crypto.ts'
import { validate } from '../../lib/validator.ts'
import { DEVICE_COOKIE, requireAdmin } from '../../middleware/auth.ts'

/** 受付端末（A-08）。いま開いている端末を登録すると、その端末に Cookie を発行する */
export const devicesRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  .get('/', async (c) => {
    const rows = await createDb(c.env).select().from(devices).orderBy(devices.id).all()
    const token = getCookie(c, DEVICE_COOKIE)
    const myHash = token ? await sha256(token) : ''
    return c.json({
      currentId: rows.find((d) => d.tokenHash === myHash)?.id ?? null,
      devices: rows.map(({ tokenHash: _, ...d }) => d),
    })
  })
  .post('/', validate('json', deviceNameSchema), async (c) => {
    const db = createDb(c.env)
    const token = randomToken()
    const r = await db.insert(devices).values({ name: c.req.valid('json').name, tokenHash: await sha256(token), createdAt: nowJst().iso }).run()
    setCookie(c, DEVICE_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 86400 })
    await audit(db, 'admin', c.get('adminId'), 'device_register', r.meta.last_row_id)
    return c.json({ ok: true }, 201)
  })
  .put('/:id', validate('json', deviceNameSchema), async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    await db.update(devices).set(c.req.valid('json')).where(eq(devices.id, id)).run()
    await audit(db, 'admin', c.get('adminId'), 'device_rename', id)
    return c.json({ ok: true })
  })
  .put('/:id/active', validate('json', deviceActiveSchema), async (c) => {
    const db = createDb(c.env)
    const id = Number(c.req.param('id'))
    const { active } = c.req.valid('json')
    await db.update(devices).set({ active }).where(eq(devices.id, id)).run()
    await audit(db, 'admin', c.get('adminId'), active ? 'device_enable' : 'device_disable', id)
    return c.json({ ok: true })
  })
