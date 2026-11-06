// PRプレビュー専用のログイン（/api/auth/preview-login）が、プレビューでだけ開くことを確かめる
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { getPlatformProxy } from 'wrangler'
import app from '../src/app.ts'

const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false })
const db = proxy.env.DB
after(() => proxy.dispose())

before(async () => {
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(`drizzle/${f}`, 'utf8').replace(/--.*$/gm, '')
    await db.batch(sql.split(';').filter((q) => q.trim()).map((q) => db.prepare(q)))
  }
})

const PREVIEW = 'https://pr-1-ikutoku-reservation-preview.example.workers.dev'
// ブラウザと同じく Origin を付ける（付けないと CSRF で 403 になる）
const login = (url: string, DEV_LOGIN?: string) =>
  app.request(`${url}/api/auth/preview-login`, { method: 'POST', headers: { Origin: url } }, { DB: db, FRONTEND_URL: url, DEV_LOGIN })

test('preview login is closed unless DEV_LOGIN=preview on workers.dev', async () => {
  assert.equal((await login(PREVIEW)).status, 404)
  assert.equal((await login('https://fes.kaitedtc.com', 'preview')).status, 404)
  assert.equal(await db.prepare('SELECT count(*) n FROM admins').first('n'), 0)
})

test('preview login creates the admin once and starts a session', async () => {
  const first = await login(PREVIEW, 'preview')
  assert.equal(first.status, 200)
  assert.match(first.headers.get('set-cookie') ?? '', /\S+=\d+\.\d+\./)
  const secret = await db.prepare("SELECT totp_secret FROM admins WHERE login_id = 'admin'").first('totp_secret')
  assert.equal((await login(PREVIEW, 'preview')).status, 200)
  // 2回目は秘密鍵を変えない（変えると先に入った人のセッションが切れる）
  assert.equal(await db.prepare("SELECT totp_secret FROM admins WHERE login_id = 'admin'").first('totp_secret'), secret)
  assert.equal(await db.prepare('SELECT count(*) n FROM admins').first('n'), 1)
})
