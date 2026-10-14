// D1 のスキーマの正。`npm run db:generate` がここから drizzle/ のマイグレーションを作る。
// どの列にも個人情報は持たない（仕様7章）。
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  openDate: text('open_date').notNull(),
  closeDate: text('close_date').notNull(),
  maxPeople: integer('max_people').notNull().default(5),
  resetSeconds: integer('reset_seconds').notNull().default(60),
  notice: text('notice').notNull().default(''),
  /** オフの間は公開ページを「準備中」にする（運用開始まで空き状況を出さない） */
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
}, (t) => [check('settings_single_row', sql`${t.id} = 1`)])

export const slotTemplates = sqliteTable('slot_templates', {
  id: integer('id').primaryKey(),
  weekday: integer('weekday').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  capacity: integer('capacity').notNull(),
  validFrom: text('valid_from'),
  validTo: text('valid_to'),
}, (t) => [
  check('slot_templates_weekday', sql`${t.weekday} BETWEEN 0 AND 6`),
  check('slot_templates_capacity', sql`${t.capacity} >= 0`),
])

// deleted は論理削除（ひな形からの再生成で復活させないため）
export const slots = sqliteTable('slots', {
  id: integer('id').primaryKey(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  capacity: integer('capacity').notNull(),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  templateId: integer('template_id').references(() => slotTemplates.id, { onDelete: 'set null' }),
}, (t) => [unique().on(t.date, t.startTime), check('slots_capacity', sql`${t.capacity} >= 0`)])

export const reservations = sqliteTable('reservations', {
  id: integer('id').primaryKey(),
  slotId: integer('slot_id').notNull().references(() => slots.id),
  people: integer('people').notNull(),
  code: text('code').notNull().unique(),
  status: text('status', { enum: ['active', 'cancelled'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
  createdByType: text('created_by_type', { enum: ['device', 'admin'] }).notNull(),
  createdById: integer('created_by_id').notNull(),
  cancelledAt: text('cancelled_at'),
}, (t) => [index('reservations_slot').on(t.slotId, t.status), check('reservations_people', sql`${t.people} > 0`)])

export const devices = sqliteTable('devices', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: text('created_at').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey(),
  loginId: text('login_id').notNull().unique(),
  totpSecret: text('totp_secret'),
  totpLastStep: integer('totp_last_step').notNull().default(0),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey(),
  at: text('at').notNull(),
  actorType: text('actor_type', { enum: ['device', 'admin', 'anonymous'] }).notNull(),
  actorId: integer('actor_id'),
  action: text('action').notNull(),
  targetId: integer('target_id'),
}, (t) => [index('audit_logs_action_at').on(t.action, t.at)])
