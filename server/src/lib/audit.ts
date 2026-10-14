import { nowJst } from '@ikutoku/shared'
import type { Db } from '../db/index.ts'
import { auditLogs } from '../db/schema.ts'

type Actor = 'device' | 'admin' | 'anonymous'

/** 操作ログ（仕様 A-10）。IPアドレスや端末の詳細は残さない */
export const audit = (db: Db, actorType: Actor, actorId: number | null, action: string, targetId: number | null = null) =>
  db.insert(auditLogs).values({ at: nowJst().iso, actorType, actorId, action, targetId }).run()
