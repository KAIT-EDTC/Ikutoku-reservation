import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, newCode, nowJst, ruleBlocks, slotState, verifyPassword, type Rule, type Settings, type Slot } from '../src/lib.ts'

const s: Settings = { open_date: '2026-11-07', close_date: '2026-11-08', max_people: 5, reset_seconds: 60, notice: '' }
const slot = (o: Partial<Slot> = {}): Slot => ({ id: 1, date: '2026-11-07', start_time: '10:00', end_time: '11:00', capacity: 8, status: 'open', booked: 0, ...o })
const rule = (o: Partial<Rule>): Rule => ({ id: 1, kind: 'once', date_from: null, date_to: null, weekday: null, nth: null, time_from: null, time_to: null, slot_id: null, memo: '', ...o })
const before = { date: '2026-11-01', time: '09:00', iso: '' }

test('rules', () => {
  assert.ok(ruleBlocks(rule({ kind: 'once', date_from: '2026-11-06', date_to: '2026-11-07' }), slot()))
  assert.ok(!ruleBlocks(rule({ kind: 'once', date_from: '2026-11-08', date_to: '2026-11-09' }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'weekly', weekday: 6 }), slot())) // 2026-11-07 is Saturday
  assert.ok(!ruleBlocks(rule({ kind: 'weekly', weekday: 6, time_from: '11:00', time_to: '12:00' }), slot())) // touching, not overlapping
  assert.ok(ruleBlocks(rule({ kind: 'weekly', weekday: 6, time_from: '10:30', time_to: '12:00' }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'monthly', weekday: 6, nth: 1 }), slot()))
  assert.ok(!ruleBlocks(rule({ kind: 'monthly', weekday: 6, nth: 2 }), slot()))
  assert.ok(ruleBlocks(rule({ kind: 'slot', slot_id: 1 }), slot()))
})

test('slot state order', () => {
  assert.deepEqual(slotState(slot(), [], s, before), { bookable: true, mark: '○', remaining: 8 })
  assert.equal(slotState(slot({ booked: 6 }), [], s, before).mark, '△')
  assert.equal(slotState(slot({ booked: 8 }), [], s, before).mark, '×')
  assert.equal(slotState(slot({ booked: 9 }), [], s, before).remaining, 0)
  assert.equal(slotState(slot({ status: 'stopped' }), [], s, before).mark, '受付停止')
  assert.equal(slotState(slot({ date: '2026-11-09' }), [], s, before).mark, '受付停止')
  assert.equal(slotState(slot(), [], s, { date: '2026-11-07', time: '10:00', iso: '' }).mark, '終了')
  assert.equal(slotState(slot({ booked: 8 }), [rule({ kind: 'slot', slot_id: 1 })], s, before).mark, '受付停止') // blackout wins
})

test('jst + codes + passwords', async () => {
  assert.deepEqual(nowJst(Date.parse('2026-11-06T15:30:00Z')).date, '2026-11-07')
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^[2-9A-HJKMNP-Z]{4}$/)
  const h = await hashPassword('correct horse')
  assert.ok(await verifyPassword('correct horse', h))
  assert.ok(!(await verifyPassword('wrong', h)))
})
