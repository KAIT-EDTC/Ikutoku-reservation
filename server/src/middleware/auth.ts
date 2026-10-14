import { and, eq } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { createDb } from '../db/index.ts'
import { devices } from '../db/schema.ts'
import type { AppEnv } from '../env.ts'
import { readSessionAdminId } from '../features/auth/session.ts'
import { sha256 } from '../lib/crypto.ts'
import { unauthorized } from '../lib/errors.ts'

export const DEVICE_COOKIE = 'dev'

/** 管理画面（/admin）。認証アプリのコードでログインした共有アカウント */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const adminId = await readSessionAdminId(c)
  if (!adminId) throw unauthorized()
  c.set('adminId', adminId)
  await next()
})

/** 受付端末（/kiosk）。管理画面で登録した端末の Cookie（紛失時は無効化できる） */
export const requireDevice = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, DEVICE_COOKIE)
  const device = token
    ? await createDb(c.env).select({ id: devices.id }).from(devices).where(and(eq(devices.tokenHash, await sha256(token)), eq(devices.active, true))).get()
    : undefined
  if (!device) throw unauthorized('受付端末として登録されていません')
  c.set('deviceId', device.id)
  await next()
})
