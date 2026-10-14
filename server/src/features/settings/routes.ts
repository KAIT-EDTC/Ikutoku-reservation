import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { renderSVG } from 'uqr'
import { otpResetSchema, settingsInputSchema } from '@ikutoku/shared'
import { createDb } from '../../db/index.ts'
import { admins, settings } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { audit } from '../../lib/audit.ts'
import { newTotpSecret, otpauthUri, verifyTotp } from '../../lib/crypto.ts'
import { badRequest } from '../../lib/errors.ts'
import { validate } from '../../lib/validator.ts'
import { requireAdmin } from '../../middleware/auth.ts'
import { generateSlots, getSettings } from '../slots/queries.ts'

const qr = (secret: string) => ({ secret, svg: renderSVG(otpauthUri(secret)) })

/** 全体設定（A-05・A-09）と、ログイン用の認証アプリ */
export const settingsRoute = new Hono<AppEnv>()
  .use(requireAdmin)
  .get('/', async (c) => c.json(await getSettings(createDb(c.env))))
  .put('/', validate('json', settingsInputSchema), async (c) => {
    const db = createDb(c.env)
    await db.update(settings).set(c.req.valid('json')).where(eq(settings.id, 1)).run()
    await generateSlots(db)
    await audit(db, 'admin', c.get('adminId'), 'settings_update')
    return c.json({ ok: true })
  })
  // 今の秘密鍵のQR（メンバーの認証アプリに追加する用）
  .get('/otp', async (c) => {
    const admin = (await createDb(c.env).select().from(admins).where(eq(admins.id, c.get('adminId'))).get())!
    return c.json(qr(admin.totpSecret!))
  })
  .get('/otp/new', (c) => c.json(qr(newTotpSecret())))
  // 新しい秘密鍵で出したコードが合えば差し替える。古いコードとセッションはすべて無効になる
  .post('/otp', validate('json', otpResetSchema), async (c) => {
    const db = createDb(c.env)
    const { secret, code } = c.req.valid('json')
    const step = await verifyTotp(secret, code)
    if (step === null) throw badRequest('コードが違います。QRを読み取り直して、表示中のコードを入力してください。')
    await db.update(admins).set({ totpSecret: secret, totpLastStep: step }).where(eq(admins.id, c.get('adminId'))).run()
    await audit(db, 'admin', c.get('adminId'), 'otp_reset')
    return c.json({ ok: true })
  })
