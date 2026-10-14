import { drizzle } from 'drizzle-orm/d1'
import type { Bindings } from '../env.ts'
import * as schema from './schema.ts'

export function createDb(env: Pick<Bindings, 'DB'>) {
  return drizzle(env.DB, { schema })
}

export type Db = ReturnType<typeof createDb>

/** UNIQUE 制約違反か（drizzle は D1 のエラーを cause に包んで投げる） */
export const isUniqueViolation = (e: unknown) => String((e as Error)?.cause ?? e).includes('UNIQUE')
