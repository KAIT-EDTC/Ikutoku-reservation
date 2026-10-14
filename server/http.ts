import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import type { ZodType } from 'zod'
import type { DB } from './queries.ts'

export type Env = { Bindings: { DB: D1Database }; Variables: { db: DB; adminId: number; deviceId: number } }

// Failures throw so that RPC response types stay success-only; app.onError turns them into { error }.
export const fail = (status: 400 | 401 | 404 | 409 | 429, message = '入力内容が正しくありません。'): never => {
  throw new HTTPException(status, { message })
}
export const valid = <T extends ZodType, K extends 'json' | 'query'>(target: K, schema: T) =>
  zValidator(target, schema, (r) => { if (!r.success) fail(400) })
