// 予約確定 tested through its interface against a real (in-memory, local) D1.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { getPlatformProxy } from 'wrangler'
import { createDb } from '../src/db/index.ts'
import { book as bookWith, newCode } from '../src/features/reservations/book.ts'

const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false })
const db = proxy.env.DB
const book = (args: Parameters<typeof bookWith>[1]) => bookWith(createDb({ DB: db }), args)
after(() => proxy.dispose())

const device = { type: 'device', id: 1 } as const
const admin = { type: 'admin', id: 1 } as const
let nextStart = 0

// Each test gets its own slot so they never share capacity.
async function slot({ date = '2099-01-03', capacity = 3, deleted = false } = {}) {
  const start = `${String(nextStart++).padStart(2, '0')}:00`
  const r = await db.prepare('INSERT INTO slots (date, start_time, end_time, capacity, deleted) VALUES (?, ?, ?, ?, ?)').bind(date, start, `${start.slice(0, 2)}:30`, capacity, Number(deleted)).run()
  return r.meta.last_row_id
}

before(async () => {
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(`drizzle/${f}`, 'utf8').replace(/--.*$/gm, '')
    await db.batch(sql.split(';').filter((q) => q.trim()).map((q) => db.prepare(q)))
  }
  await db.prepare("UPDATE settings SET open_date = '2000-01-01', close_date = '2099-12-31', max_people = 5").run()
})

test('device booking returns a code and is stored', async () => {
  const id = await slot()
  const r = await book({ slotId: id, people: 2, by: device })
  assert.ok(r.ok)
  assert.match(r.code, /^[2-9A-HJKMNP-Z]{4}$/)
  assert.equal(await db.prepare("SELECT people FROM reservations WHERE code = ? AND status = 'active'").bind(r.code).first('people'), 2)
})

test('people must be within 1..max_people for devices', async () => {
  const id = await slot({ capacity: 10 })
  for (const people of [0, 6, 1.5, NaN]) assert.deepEqual(await book({ slotId: id, people, by: device }), { ok: false, reason: 'invalid_people' })
})

test('unknown or deleted slot is not_found', async () => {
  assert.deepEqual(await book({ slotId: 999999, people: 1, by: device }), { ok: false, reason: 'not_found' })
  assert.deepEqual(await book({ slotId: NaN, people: 1, by: device }), { ok: false, reason: 'not_found' })
  assert.deepEqual(await book({ slotId: await slot({ deleted: true }), people: 1, by: admin }), { ok: false, reason: 'not_found' })
})

test('devices cannot book blacked-out, past or out-of-period slots; admins can', async () => {
  const past = await slot({ date: '2000-01-01' })
  const outside = await slot({ date: '1999-12-31' })
  const blocked = await slot()
  await db.prepare("INSERT INTO blackout_rules (kind, slot_id) VALUES ('slot', ?)").bind(blocked).run()
  for (const id of [past, outside, blocked]) {
    assert.deepEqual(await book({ slotId: id, people: 1, by: device }), { ok: false, reason: 'unavailable' })
    assert.ok((await book({ slotId: id, people: 1, by: admin })).ok)
  }
})

test('F-06: racing devices never exceed capacity', async () => {
  const id = await slot({ capacity: 3 })
  const results = await Promise.all(Array.from({ length: 8 }, () => book({ slotId: id, people: 1, by: device })))
  assert.equal(results.filter((r) => r.ok).length, 3)
  assert.ok(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === 'full'))
  assert.equal(await db.prepare("SELECT SUM(people) AS n FROM reservations WHERE slot_id = ? AND status = 'active'").bind(id).first('n'), 3)
})

test('a booking larger than the remaining seats is full, cancellations free seats', async () => {
  const id = await slot({ capacity: 3 })
  const first = await book({ slotId: id, people: 2, by: device })
  assert.deepEqual(await book({ slotId: id, people: 2, by: device }), { ok: false, reason: 'full' })
  assert.ok(first.ok)
  await db.prepare("UPDATE reservations SET status = 'cancelled' WHERE code = ?").bind(first.code).run()
  assert.ok((await book({ slotId: id, people: 3, by: device })).ok)
})

test('admins exceed capacity only with overbook', async () => {
  const id = await slot({ capacity: 1 })
  assert.ok((await book({ slotId: id, people: 1, by: admin })).ok)
  assert.deepEqual(await book({ slotId: id, people: 1, by: admin }), { ok: false, reason: 'full' })
  assert.ok((await book({ slotId: id, people: 20, by: { ...admin, overbook: true } })).ok)
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'reserve_overbook'").first('n'), 1)
})

test('reservation codes avoid misreadable characters', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^[2-9A-HJKMNP-Z]{4}$/)
})
