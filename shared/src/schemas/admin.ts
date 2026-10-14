import { z } from 'zod'

const date = z.iso.date('日付を入力してください')
const time = z.string().regex(/^\d{2}:\d{2}$/, '時刻を入力してください')
const capacity = z.number().int('定員は整数にしてください').min(0, '定員は0以上にしてください').max(999, '定員が大きすぎます')
const timeOrder = { path: ['endTime'], message: '終了時刻は開始時刻より後にしてください' }
const memo = z.string().trim().max(100, 'メモは100文字以内にしてください')

/** 管理者ログイン: 認証アプリの6桁コード */
export const loginSchema = z.object({ code: z.string().regex(/^\d{6}$/, '6桁の数字を入力してください') })

const slotFields = z.object({ startTime: time, endTime: time, capacity })
export const slotUpdateSchema = slotFields.refine((v) => v.startTime < v.endTime, timeOrder)
export const slotInputSchema = slotFields.extend({ date }).refine((v) => v.startTime < v.endTime, timeOrder)
export const slotStopSchema = z.object({ stopped: z.boolean() })

/** 代理予約。overbook のときだけ定員を超えて登録できる */
export const adminReserveSchema = z.object({
  slotId: z.number().int(),
  people: z.number().int().min(1, '人数は1以上にしてください').max(99, '人数が多すぎます'),
  overbook: z.boolean(),
})

export const templateInputSchema = slotFields
  .extend({ weekday: z.number().int().min(0).max(6), validFrom: date.nullable(), validTo: date.nullable() })
  .refine((v) => v.startTime < v.endTime, timeOrder)
  .refine((v) => !v.validFrom || !v.validTo || v.validFrom <= v.validTo, { path: ['validTo'], message: '適用期間の終わりは始まりより後にしてください' })

/** 時間帯は両方空（終日）か、両方入力して開始 < 終了 */
const timeRange = { timeFrom: time.nullable(), timeTo: time.nullable() }

export const blackoutInputSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('once'), dateFrom: date, dateTo: date, ...timeRange, memo }),
    z.object({ kind: z.literal('weekly'), weekday: z.number().int().min(0).max(6), ...timeRange, memo }),
    z.object({ kind: z.literal('monthly'), weekday: z.number().int().min(0).max(6), nth: z.number().int().min(1).max(5), ...timeRange, memo }),
    z.object({ kind: z.literal('slot'), slotId: z.number().int().positive('コマを選んでください'), memo }),
  ])
  .refine((v) => v.kind === 'slot' || (!v.timeFrom && !v.timeTo) || (!!v.timeFrom && !!v.timeTo && v.timeFrom < v.timeTo), { path: ['timeTo'], message: '時間帯は開始・終了の両方を入力してください（または両方空欄）' })
  .refine((v) => v.kind !== 'once' || v.dateFrom <= v.dateTo, { path: ['dateTo'], message: '終わりの日付は始まりより後にしてください' })
export type BlackoutInput = z.infer<typeof blackoutInputSchema>

export const settingsInputSchema = z
  .object({
    openDate: date,
    closeDate: date,
    maxPeople: z.number().int().min(1, '1名以上にしてください').max(50, '50名以下にしてください'),
    resetSeconds: z.number().int().min(10, '10秒以上にしてください').max(600, '600秒以下にしてください'),
    notice: z.string().max(1000, 'お知らせは1000文字以内にしてください'),
  })
  .refine((v) => v.openDate <= v.closeDate, { path: ['closeDate'], message: '受付期間の終わりは始まりより後にしてください' })

export const deviceNameSchema = z.object({ name: z.string().trim().min(1, '端末名を入力してください').max(40, '端末名は40文字以内にしてください') })
export const deviceActiveSchema = z.object({ active: z.boolean() })

/** 認証アプリの再発行: 新しい秘密鍵と、それで出した6桁コード */
export const otpResetSchema = z.object({ secret: z.string().regex(/^[A-Z2-7]{32}$/), code: loginSchema.shape.code })
