import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { loginSchema, nowJst } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { admins, auditLogs } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { newTotpSecret, verifyTotp } from '../../lib/crypto.ts'
import { badRequest, notFound, tooManyRequests } from '../../lib/errors.ts'
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
  // PRプレビュー専用: 認証アプリのコードなしでログインする。
  // DEV_LOGIN は env.preview.previews だけが設定する。本番は独自ドメインで配信しているので workers.dev の条件でも弾かれる
  .post('/preview-login', async (c) => {
    if (c.env.DEV_LOGIN !== 'preview' || !new URL(c.req.url).hostname.endsWith('.workers.dev')) throw notFound()
    const db = createDb(c.env)
    // プレビューのD1には管理者がいないので作る。秘密鍵はセッションの署名に使うだけで、誰も認証アプリに登録しない
    const secret = newTotpSecret()
    const admin = await db
      .insert(admins)
      .values({ loginId: 'admin', totpSecret: secret })
      .onConflictDoUpdate({ target: admins.loginId, set: { totpSecret: sql`coalesce(${admins.totpSecret}, ${secret})` } })
      .returning()
      .get()
    await startSession(c, { id: admin.id, totpSecret: admin.totpSecret! })
    await audit(db, 'admin', admin.id, 'login')
    return c.json({ ok: true })
  })
  .post('/logout', (c) => {
    endSession(c)
    return c.json({ ok: true })
  })
  .get('/me', requireAdmin, (c) => c.json({ adminId: c.get('adminId') }))
