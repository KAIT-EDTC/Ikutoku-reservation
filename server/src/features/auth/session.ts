import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createDb } from '../../db/index.ts'
import { admins } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { hmac, safeEqual } from '../../lib/crypto.ts'

// 旧版の Cookie（adm, path=/api/admin）と名前を分け、残っていても新しいセッションを隠さないようにする
const COOKIE = 'admin_session'
const SESSION_MS = 12 * 3600_000
const OPTIONS = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/api' } as const

// Cookie = id.expiry.HMAC(totp_secret, id.expiry)。認証アプリを再発行すると全員ログアウトされる（別の秘密鍵は要らない）
const sign = (admin: { id: number; totpSecret: string }, exp: number) => hmac(admin.totpSecret, `${admin.id}.${exp}`)

export async function startSession(c: Context<AppEnv>, admin: { id: number; totpSecret: string }) {
  const exp = Date.now() + SESSION_MS
  setCookie(c, COOKIE, `${admin.id}.${exp}.${await sign(admin, exp)}`, { ...OPTIONS, maxAge: SESSION_MS / 1000 })
}

export const endSession = (c: Context<AppEnv>) => deleteCookie(c, COOKIE, OPTIONS)

/** 有効なセッションなら管理者ID */
export async function readSessionAdminId(c: Context<AppEnv>) {
  const [id, exp, sig] = (getCookie(c, COOKIE) ?? '').split('.')
  if (!(Number(exp) > Date.now())) return null
  const admin = await createDb(c.env).select().from(admins).where(eq(admins.id, Number(id))).get()
  if (!admin?.totpSecret || !safeEqual(await sign({ id: admin.id, totpSecret: admin.totpSecret }, Number(exp)), sig ?? '')) return null
  return admin.id
}
