import { and, eq, gt, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { loginSchema, nowJst } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { admins, auditLogs } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { verifyTotp } from '../../lib/crypto.ts'
import { badRequest, tooManyRequests } from '../../lib/errors.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { endSession, startSession } from './session.ts'

/** IPアドレスを持たないため、失敗回数は全体で数える（15分に10回まで） */
const MAX_FAILS = 10

export const authRoute = new Hono<AppEnv>()
  // ログイン = 認証アプリの6桁コード（共有アカウント・共有の秘密鍵）
  .post('/login', validate('json', loginSchema), async (c) => {
    const db = createDb(c.env)
    const since = nowJst(Date.now() - 15 * 60_000).iso
    const fails = await db.$count(auditLogs, and(eq(auditLogs.action, 'login_failed'), gt(auditLogs.at, since)))
    if (fails >= MAX_FAILS) throw tooManyRequests('ログイン失敗が続いたため一時的に停止しています。15分ほど待ってから再度お試しください。')
    const admin = await db.select().from(admins).where(eq(admins.loginId, 'admin')).get()
    const step = admin?.totpSecret ? await verifyTotp(admin.totpSecret, c.req.valid('json').code) : null
    // 使ったステップを条件付きUPDATEで消費するので、同じコードは1回しか使えない
    const fresh =
      step !== null &&
      (await db.update(admins).set({ totpLastStep: step }).where(and(eq(admins.id, admin!.id), lt(admins.totpLastStep, step))).run()).meta.changes
    if (!fresh) {
      await audit(db, 'anonymous', null, 'login_failed')
      throw badRequest('コードが違うか、使用済みです。次のコードでお試しください。')
    }
    await startSession(c, { id: admin!.id, totpSecret: admin!.totpSecret! })
    await audit(db, 'admin', admin!.id, 'login')
    return c.json({ ok: true })
  })
  .post('/logout', (c) => {
    endSession(c)
    return c.json({ ok: true })
  })
  .get('/me', requireAdmin, (c) => c.json({ adminId: c.get('adminId') }))
