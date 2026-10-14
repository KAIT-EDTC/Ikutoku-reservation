import { z } from 'zod'

/** 受付端末からの予約。人数の上限（全体設定の最大人数）はサーバーが判定する */
export const reserveSchema = z.object({
  slotId: z.number().int(),
  people: z.number().int().min(1, '人数を選んでください'),
})
