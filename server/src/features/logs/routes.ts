import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createDb } from '../../db/index.ts'
import { admins, auditLogs, devices } from '../../db/schema.ts'
import type { AppEnv } from '../../env.ts'
import { requireAdmin } from '../../middleware/auth.ts'

/** 操作ログ（A-10）。直近500件 */
export const logsRoute = new Hono<AppEnv>().use(requireAdmin).get('/', async (c) =>
  c.json({
    logs: await createDb(c.env)
      .select({
        id: auditLogs.id,
        at: auditLogs.at,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        targetId: auditLogs.targetId,
        deviceName: devices.name,
        loginId: admins.loginId,
      })
      .from(auditLogs)
      .leftJoin(devices, and(eq(auditLogs.actorType, 'device'), eq(devices.id, auditLogs.actorId)))
      .leftJoin(admins, and(eq(auditLogs.actorType, 'admin'), eq(admins.id, auditLogs.actorId)))
      .orderBy(desc(auditLogs.id))
      .limit(500)
      .all(),
  }),
)
