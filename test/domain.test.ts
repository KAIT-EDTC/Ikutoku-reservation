import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newTotpSecret, totp, verifyTotp } from '../server/auth.ts'
import { newCode, nowJst, ruleBlocks, slotState, type Rule, type Settings, type Slot } from '../server/domain.ts'

const s: Settings = { id: 1, openDate: '2026-11-07', closeDate: '2026-11-08', maxPeople: 5, resetSeconds: 60, notice: '' }
const slot = (o: Partial<Slot> = {}): Slot => ({ id: 1, date: '2026-11-07', startTime: '10:00', endTime: '11:00', capacity: 8, booked: 0, ...o })
const rule = (o: Partial<Rule>): Rule => ({ id: 1, kind: 'once', dateFrom: null, dateTo: null, weekday: null, nth: null, timeFrom: null, timeTo: null, slotId: null, memo: '', ...o })
const before = { date: '2026-11-01', time: '09:00', iso: '' }

test('rules', () => {
  assert.ok(ruleBlocks(rule({ kind: 'once', dateFrom: '2026-11-06', dateTo: '2026-11-07' }), slot()))
  assert.ok(!ruleBlocks(rule({ kind: 'once', dateFrom: '2026-11-08', dateTo: '2026-11-09' }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'weekly', weekday: 6 }), slot())) // 2026-11-07 is Saturday
  assert.ok(!ruleBlocks(rule({ kind: 'weekly', weekday: 6, timeFrom: '11:00', timeTo: '12:00' }), slot())) // touching, not overlapping
  assert.ok(ruleBlocks(rule({ kind: 'weekly', weekday: 6, timeFrom: '10:30', timeTo: '12:00' }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'monthly', weekday: 6, nth: 1 }), slot()))
  assert.ok(!ruleBlocks(rule({ kind: 'monthly', weekday: 6, nth: 2 }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'slot', slotId: 1 }), slot()))
})

test('slot state order', () => {
  assert.deepEqual(slotState(slot(), [], s, before), { status: 'ok', remaining: 8, bookable: true })
  assert.equal(slotState(slot({ booked: 6 }), [], s, before).status, 'few')
  assert.equal(slotState(slot({ booked: 8 }), [], s, before).status, 'full')
  assert.equal(slotState(slot({ booked: 9 }), [], s, before).remaining, 0)
  assert.equal(slotState(slot({ date: '2026-11-09' }), [], s, before).status, 'stopped')
  assert.equal(slotState(slot(), [], s, { date: '2026-11-07', time: '10:00', iso: '' }).status, 'ended')
  assert.equal(slotState(slot({ booked: 8 }), [rule({ kind: 'slot', slotId: 1 })], s, before).status, 'stopped') // blackout wins
})

test('jst + codes + totp', async () => {
  assert.deepEqual(nowJst(Date.parse('2026-11-06T15:30:00Z')).date, '2026-11-07')
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^[2-9A-HJKMNP-Z]{4}$/)
  // RFC 6238 appendix B vectors (secret = ASCII "12345678901234567890"), last 6 digits
  const rfc = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  assert.equal(await totp(rfc, Math.floor(59 / 30)), '287082')
  assert.equal(await totp(rfc, Math.floor(1111111109 / 30)), '081804')
  assert.equal(await totp(rfc, Math.floor(20000000000 / 30)), '353130')
  assert.equal(await verifyTotp(rfc, '081804', 1111111109_000 + 30_000), Math.floor(1111111109 / 30)) // previous step still accepted
  assert.equal(await verifyTotp(rfc, '081804', 1111111109_000 + 90_000), null)
  assert.match(newTotpSecret(), /^[A-Z2-7]{32}$/)
})
