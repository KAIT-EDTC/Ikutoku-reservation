import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nowJst } from '../src/date.ts'
import { slotState, type Settings, type Slot } from '../src/slots.ts'

const s: Settings = { openDate: '2026-11-07', closeDate: '2026-11-08', maxPeople: 5, resetSeconds: 60, notice: '', published: true }
const slot = (o: Partial<Slot> = {}): Slot => ({ id: 1, date: '2026-11-07', startTime: '10:00', endTime: '11:00', capacity: 8, booked: 0, ...o })
const before = { date: '2026-11-01', time: '09:00', iso: '' }

test('slot state order', () => {
  assert.deepEqual(slotState(slot(), s, before), { status: 'ok', remaining: 8, bookable: true })
  assert.equal(slotState(slot({ booked: 6 }), s, before).status, 'few')
  assert.equal(slotState(slot({ booked: 8 }), s, before).status, 'full')
  assert.equal(slotState(slot({ booked: 9 }), s, before).remaining, 0)
  assert.equal(slotState(slot({ date: '2026-11-09' }), s, before).status, 'stopped')
  assert.equal(slotState(slot(), s, { date: '2026-11-07', time: '10:00', iso: '' }).status, 'ended')
})

test('jst', () => {
  assert.equal(nowJst(Date.parse('2026-11-06T15:30:00Z')).date, '2026-11-07')
})
