import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nowJst } from '../src/date.ts'
import { blackoutInputSchema } from '../src/schemas/admin.ts'
import { ruleBlocks, slotState, type Rule, type Settings, type Slot } from '../src/slots.ts'

const s: Settings = { openDate: '2026-11-07', closeDate: '2026-11-08', maxPeople: 5, resetSeconds: 60, notice: '' }
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

test('jst', () => {
  assert.equal(nowJst(Date.parse('2026-11-06T15:30:00Z')).date, '2026-11-07')
})

test('blackout input: time range is both-or-neither, dates in order', () => {
  const once = { kind: 'once', dateFrom: '2026-11-07', dateTo: '2026-11-08', timeFrom: null, timeTo: null, memo: '' } as const
  assert.ok(blackoutInputSchema.safeParse(once).success)
  assert.ok(blackoutInputSchema.safeParse({ ...once, timeFrom: '10:00', timeTo: '12:00' }).success)
  assert.ok(!blackoutInputSchema.safeParse({ ...once, timeFrom: '10:00' }).success)
  assert.ok(!blackoutInputSchema.safeParse({ ...once, timeFrom: '12:00', timeTo: '10:00' }).success)
  assert.ok(!blackoutInputSchema.safeParse({ ...once, dateFrom: '2026-11-09' }).success)
  assert.ok(blackoutInputSchema.safeParse({ kind: 'slot', slotId: 3, memo: '' }).success)
})
