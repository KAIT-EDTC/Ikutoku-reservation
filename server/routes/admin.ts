import { and, eq, gt, like, lt, notExists, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { renderSVG } from 'uqr'
import { z } from 'zod'
import { hmac, newTotpSecret, otpauthUri, randomToken, safeEqual, sha256, TOTP_SECRET, verifyTotp } from '../auth.ts'
import { book } from '../booking.ts'
import { nowJst, ruleBlocks, slotState } from '../domain.ts'
import { fail, valid, type Env } from '../http.ts'
import { generateSlots, getRules, getSettings, isUnique, listSlots, log, type DB } from '../queries.ts'
import { admins, auditLogs, blackoutRules, devices, reservations, settings, slots, slotTemplates } from '../schema.ts'

const SESSION_MS = 12 * 3600_000
const MAX_FAILS = 10 // per 15 minutes, counted globally because we keep no IP addresses
const COOKIE = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/api/admin' } as const

// Form fields arrive as strings, so numbers are coerced and empty optional fields become null.
const date = z.iso.date()
const time = z.string().regex(/^\d{2}:\d{2}$/)
const blank = <T extends z.ZodType<string>>(t: T) => z.union([t, z.literal('')]).transform((v) => v || null)
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max)
const slotTimes = z.object({ startTime: time, endTime: time, capacity: int(0, 999) }).refine((v) => v.startTime < v.endTime)
const timeRange = { timeFrom: blank(time), timeTo: blank(time) }
const memo = z.string().max(100).default('')
const deviceName = z.object({ name: z.string().trim().min(1).max(40) })
const SLOT_TAKEN = 'その開始時刻のコマは既にあります。'

const reservationRows = (db: DB, where: SQL) =>
  db.select({
    id: reservations.id, slotId: reservations.slotId, code: reservations.code, people: reservations.people, status: reservations.status,
    createdAt: reservations.createdAt, createdByType: reservations.createdByType, cancelledAt: reservations.cancelledAt, deviceName: devices.name,
    date: slots.date, startTime: slots.startTime, endTime: slots.endTime,
  })
    .from(reservations)
    .innerJoin(slots, eq(slots.id, reservations.slotId))
    .leftJoin(devices, and(eq(reservations.createdByType, 'device'), eq(devices.id, reservations.createdById)))
    .where(where)
    .orderBy(reservations.createdAt)
    .all()

// Session cookie = id.expiry.HMAC(totp_secret, id.expiry): re-issuing the secret logs everyone out, no extra secret needed.
const sign = (a: { id: number; totpSecret: string }, exp: number) => hmac(a.totpSecret, `${a.id}.${exp}`)
const qr = (secret: string) => ({ secret, svg: renderSVG(otpauthUri(secret)) })

export default new Hono<Env>()
  // ---------- auth: registered before the guard, so the guard does not run for these ----------
  // Login = 6-digit TOTP code from an authenticator app (shared account, shared secret).
  .post('/login', valid('json', z.object({ code: z.string() })), async (c) => {
    const db = c.var.db
    const fails = await db.$count(auditLogs, and(eq(auditLogs.action, 'login_failed'), gt(auditLogs.at, nowJst(Date.now() - 15 * 60_000).iso)))
    if (fails >= MAX_FAILS) fail(429, 'ログイン失敗が続いたため一時的に停止しています。15分ほど待ってから再度お試しください。')
    const a = await db.select().from(admins).where(eq(admins.loginId, 'admin')).get()
    const step = a?.totpSecret ? await verifyTotp(a.totpSecret, c.req.valid('json').code.trim()) : null
    // Consuming the step atomically makes each code single-use.
    const fresh = step !== null && (await db.update(admins).set({ totpLastStep: step }).where(and(eq(admins.id, a!.id), lt(admins.totpLastStep, step))).run()).meta.changes
    if (!fresh) {
      await log(db, 'anonymous', null, 'login_failed')
      fail(400, 'コードが違うか、使用済みです。次のコードでお試しください。')
    }
    const exp = Date.now() + SESSION_MS
    setCookie(c, 'adm', `${a!.id}.${exp}.${await sign({ id: a!.id, totpSecret: a!.totpSecret! }, exp)}`, { ...COOKIE, maxAge: SESSION_MS / 1000 })
    await log(db, 'admin', a!.id, 'login')
    return c.json({ ok: true })
  })
  .post('/logout', (c) => {
    deleteCookie(c, 'adm', COOKIE)
    return c.json({ ok: true })
  })
  .use(async (c, next) => {
    const [id, exp, sig] = (getCookie(c, 'adm') ?? '').split('.')
    const a = Number(exp) > Date.now() && (await c.var.db.select().from(admins).where(eq(admins.id, Number(id))).get())
    if (!a || !a.totpSecret || !safeEqual(await sign({ id: a.id, totpSecret: a.totpSecret }, Number(exp)), sig ?? '')) return fail(401, 'ログインしてください。')
    c.set('adminId', a.id)
    await next()
  })

  // ---------- day view (today / calendar day) ----------
  .get('/day/:date', async (c) => {
    const db = c.var.db
    const d = date.safeParse(c.req.param('date'))
    if (!d.success) return fail(400)
    const [s, rules, list, res] = await Promise.all([getSettings(db), getRules(db), listSlots(db, eq(slots.date, d.data)), reservationRows(db, eq(slots.date, d.data))])
    return c.json({
      slots: list.map((sl) => ({
        ...sl, ...slotState(sl, rules, s),
        stopRule: rules.some((r) => r.kind === 'slot' && r.slotId === sl.id),
        reservations: res.filter((r) => r.slotId === sl.id),
      })),
    })
  })
  .get('/reservations', valid('query', z.object({ code: z.string() })), async (c) => {
    const [found] = await reservationRows(c.var.db, eq(reservations.code, c.req.valid('query').code.trim().toUpperCase()))
    return c.json({ found: found ?? null })
  })
  .get('/calendar', valid('query', z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() })), async (c) => {
    const db = c.var.db
    const s = await getSettings(db)
    const month = c.req.valid('query').month ?? s.openDate.slice(0, 7)
    const days: Record<string, { n: number; capacity: number; booked: number }> = {}
    for (const sl of await listSlots(db, like(slots.date, `${month}-%`))) {
      const d = (days[sl.date] ??= { n: 0, capacity: 0, booked: 0 })
      d.n++, (d.capacity += sl.capacity), (d.booked += sl.booked)
    }
    return c.json({ month, openDate: s.openDate, closeDate: s.closeDate, days })
  })

  // ---------- slots ----------
  .post('/slots', valid('json', slotTimes.and(z.object({ date }))), async (c) => {
    const v = c.req.valid('json')
    // Re-adding a time that was soft-deleted revives that row.
    const r = await c.var.db.insert(slots).values(v)
      .onConflictDoUpdate({ target: [slots.date, slots.startTime], set: { endTime: v.endTime, capacity: v.capacity, deleted: false }, setWhere: eq(slots.deleted, true) }).run()
    if (!r.meta.changes) fail(409, SLOT_TAKEN)
    await log(c.var.db, 'admin', c.get('adminId'), 'slot_create', r.meta.last_row_id)
    return c.json({ ok: true })
  })
  .put('/slots/:id', valid('json', slotTimes), async (c) => {
    const id = Number(c.req.param('id'))
    try {
      await c.var.db.update(slots).set(c.req.valid('json')).where(and(eq(slots.id, id), eq(slots.deleted, false))).run()
    } catch (e) {
      if (isUnique(e)) fail(409, SLOT_TAKEN)
      throw e
    }
    await log(c.var.db, 'admin', c.get('adminId'), 'slot_update', id)
    return c.json({ ok: true })
  })
  .delete('/slots/:id', async (c) => {
    const db = c.var.db
    const id = Number(c.req.param('id'))
    const active = db.select({ x: sql`1` }).from(reservations).where(and(eq(reservations.slotId, id), eq(reservations.status, 'active')))
    const r = await db.update(slots).set({ deleted: true }).where(and(eq(slots.id, id), notExists(active))).run()
    if (!r.meta.changes) fail(409, '有効な予約があるコマは削除できません。先に予約を取り消すか、コマを受付停止にしてください。')
    await log(db, 'admin', c.get('adminId'), 'slot_delete', id)
    return c.json({ ok: true })
  })
  // Stopping one slot = a blackout rule of kind 'slot' (spec §6), toggled from the day view.
  .post('/slots/:id/stop', valid('json', z.object({ stopped: z.boolean() })), async (c) => {
    const db = c.var.db
    const id = Number(c.req.param('id'))
    const where = and(eq(blackoutRules.kind, 'slot'), eq(blackoutRules.slotId, id))
    if (c.req.valid('json').stopped) {
      if (!(await db.$count(blackoutRules, where))) await db.insert(blackoutRules).values({ kind: 'slot', slotId: id }).run()
    } else await db.delete(blackoutRules).where(where).run()
    await log(db, 'admin', c.get('adminId'), c.req.valid('json').stopped ? 'slot_stop' : 'slot_resume', id)
    return c.json({ ok: true })
  })

  // ---------- reservations ----------
  .post('/reservations', valid('json', z.object({ slotId: z.coerce.number(), people: z.coerce.number(), overbook: z.coerce.boolean().optional() })), async (c) => {
    const { slotId, people, overbook } = c.req.valid('json')
    const r = await book(c.var.db, { slotId, people, by: { type: 'admin', id: c.get('adminId'), overbook } })
    if (!r.ok) return r.reason === 'full' ? fail(409, '定員を超えるため登録できません。必要なら「定員超過を許可」にチェックしてください。') : fail(400)
    return c.json({ code: r.code, people })
  })
  .post('/reservations/:id/cancel', async (c) => {
    const id = Number(c.req.param('id'))
    const r = await c.var.db.update(reservations).set({ status: 'cancelled', cancelledAt: nowJst().iso }).where(and(eq(reservations.id, id), eq(reservations.status, 'active'))).run()
    if (r.meta.changes) await log(c.var.db, 'admin', c.get('adminId'), 'cancel', id)
    return c.json({ ok: true })
  })

  // ---------- templates ----------
  .get('/templates', async (c) => c.json(await c.var.db.select().from(slotTemplates).orderBy(slotTemplates.weekday, slotTemplates.startTime).all()))
  .post('/templates', valid('json', slotTimes.and(z.object({ weekday: int(0, 6), validFrom: blank(date), validTo: blank(date) }))), async (c) => {
    const db = c.var.db
    const r = await db.insert(slotTemplates).values(c.req.valid('json')).run()
    await generateSlots(db)
    await log(db, 'admin', c.get('adminId'), 'template_create', r.meta.last_row_id)
    return c.json({ ok: true })
  })
  .delete('/templates/:id', async (c) => {
    const db = c.var.db
    const id = Number(c.req.param('id'))
    const any = db.select({ x: sql`1` }).from(reservations).where(eq(reservations.slotId, slots.id))
    // Slots that keep reservations stay; the FK clears their template_id.
    await db.batch([
      db.delete(slots).where(and(eq(slots.templateId, id), notExists(any))),
      db.delete(slotTemplates).where(eq(slotTemplates.id, id)),
    ])
    await log(db, 'admin', c.get('adminId'), 'template_delete', id)
    return c.json({ ok: true })
  })

  // ---------- blackout rules ----------
  .get('/blackouts', async (c) => {
    const db = c.var.db
    const [rules, list] = await Promise.all([getRules(db), listSlots(db)])
    return c.json({
      rules: rules.map((r) => ({ ...r, affected: list.filter((s) => ruleBlocks(r, s)).reduce((a, s) => a + s.count, 0) })),
      slots: list.map(({ id, date, startTime, endTime }) => ({ id, date, startTime, endTime })),
    })
  })
  .post('/blackouts', valid('json', z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('once'), dateFrom: date, dateTo: date, ...timeRange, memo }),
    z.object({ kind: z.literal('weekly'), weekday: int(0, 6), ...timeRange, memo }),
    z.object({ kind: z.literal('monthly'), weekday: int(0, 6), nth: int(1, 5), ...timeRange, memo }),
    z.object({ kind: z.literal('slot'), slotId: int(1, Number.MAX_SAFE_INTEGER), memo }),
  ])), async (c) => {
    const v = c.req.valid('json')
    if ('timeFrom' in v && (v.timeFrom || v.timeTo) && !(v.timeFrom && v.timeTo && v.timeFrom < v.timeTo)) fail(400, '時間帯は開始・終了の両方を入力してください（または両方空欄）。')
    if (v.kind === 'once' && v.dateFrom > v.dateTo) fail(400)
    const r = await c.var.db.insert(blackoutRules).values(v).run()
    await log(c.var.db, 'admin', c.get('adminId'), 'blackout_create', r.meta.last_row_id)
    return c.json({ ok: true })
  })
  .delete('/blackouts/:id', async (c) => {
    const id = Number(c.req.param('id'))
    await c.var.db.delete(blackoutRules).where(eq(blackoutRules.id, id)).run()
    await log(c.var.db, 'admin', c.get('adminId'), 'blackout_delete', id)
    return c.json({ ok: true })
  })

  // ---------- settings ----------
  .get('/settings', async (c) => c.json(await getSettings(c.var.db)))
  .put('/settings', valid('json', z.object({ openDate: date, closeDate: date, maxPeople: int(1, 50), resetSeconds: int(10, 600), notice: z.string().max(1000) })), async (c) => {
    const v = c.req.valid('json')
    if (v.openDate > v.closeDate) fail(400)
    const db = c.var.db
    await db.update(settings).set(v).where(eq(settings.id, 1)).run()
    await generateSlots(db)
    await log(db, 'admin', c.get('adminId'), 'settings_update')
    return c.json({ ok: true })
  })

  // ---------- OTP (authenticator app) ----------
  .get('/otp', async (c) => {
    const a = (await c.var.db.select().from(admins).where(eq(admins.id, c.get('adminId'))).get())!
    return c.json(qr(a.totpSecret!))
  })
  .get('/otp/new', (c) => c.json(qr(newTotpSecret())))
  .post('/otp', valid('json', z.object({ secret: z.string().regex(TOTP_SECRET), code: z.string() })), async (c) => {
    const { secret, code } = c.req.valid('json')
    const step = await verifyTotp(secret, code.trim())
    if (step === null) fail(400, 'コードが違います。QRを読み取り直して、表示中のコードを入力してください。')
    await c.var.db.update(admins).set({ totpSecret: secret, totpLastStep: step! }).where(eq(admins.id, c.get('adminId'))).run()
    await log(c.var.db, 'admin', c.get('adminId'), 'otp_reset')
    return c.json({ ok: true })
  })

  // ---------- kiosk devices ----------
  .get('/devices', async (c) => {
    const token = getCookie(c, 'dev')
    const rows = await c.var.db.select().from(devices).orderBy(devices.id).all()
    const myHash = token ? await sha256(token) : ''
    return c.json({
      currentId: rows.find((d) => d.tokenHash === myHash)?.id ?? null,
      devices: rows.map(({ tokenHash, ...d }) => d),
    })
  })
  .post('/devices', valid('json', deviceName), async (c) => {
    const token = randomToken()
    const r = await c.var.db.insert(devices).values({ name: c.req.valid('json').name, tokenHash: await sha256(token), createdAt: nowJst().iso }).run()
    setCookie(c, 'dev', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 86400 })
    await log(c.var.db, 'admin', c.get('adminId'), 'device_register', r.meta.last_row_id)
    return c.json({ ok: true })
  })
  .put('/devices/:id', valid('json', deviceName), async (c) => {
    const id = Number(c.req.param('id'))
    await c.var.db.update(devices).set(c.req.valid('json')).where(eq(devices.id, id)).run()
    await log(c.var.db, 'admin', c.get('adminId'), 'device_rename', id)
    return c.json({ ok: true })
  })
  .post('/devices/:id/active', valid('json', z.object({ active: z.boolean() })), async (c) => {
    const id = Number(c.req.param('id'))
    const { active } = c.req.valid('json')
    await c.var.db.update(devices).set({ active }).where(eq(devices.id, id)).run()
    await log(c.var.db, 'admin', c.get('adminId'), active ? 'device_enable' : 'device_disable', id)
    return c.json({ ok: true })
  })

  // ---------- audit log ----------
  .get('/logs', async (c) => c.json(await c.var.db.select({
    id: auditLogs.id, at: auditLogs.at, actorType: auditLogs.actorType, action: auditLogs.action, targetId: auditLogs.targetId,
    deviceName: devices.name, loginId: admins.loginId,
  })
    .from(auditLogs)
    .leftJoin(devices, and(eq(auditLogs.actorType, 'device'), eq(devices.id, auditLogs.actorId)))
    .leftJoin(admins, and(eq(auditLogs.actorType, 'admin'), eq(admins.id, auditLogs.actorId)))
    .orderBy(sql`${auditLogs.id} DESC`)
    .limit(500)
    .all()))
