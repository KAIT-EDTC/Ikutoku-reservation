import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './env.ts'
import { authRoute } from './features/auth/routes.ts'
import { devicesRoute } from './features/devices/routes.ts'
import { kioskRoute } from './features/kiosk/routes.ts'
import { logsRoute } from './features/logs/routes.ts'
import { publicRoute } from './features/public/routes.ts'
import { reservationsRoute } from './features/reservations/routes.ts'
import { settingsRoute } from './features/settings/routes.ts'
import { slotsRoute } from './features/slots/routes.ts'

const app = new Hono<AppEnv>()

app.use('/api/*', (c, next) => cors({ origin: c.env.FRONTEND_URL, credentials: true })(c, next))
// フォーム送信によるCSRFを防ぐ（JSONはCORSのプリフライトで守られる）
app.use('/api/*', (c, next) => csrf({ origin: c.env.FRONTEND_URL })(c, next))
app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'same-origin')
})

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status)
  }
  console.error(error)
  return c.json({ error: 'サーバーでエラーが発生しました' }, 500)
})

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

const routes = app
  .route('/api/public', publicRoute)
  .route('/api/kiosk', kioskRoute)
  .route('/api/auth', authRoute)
  .route('/api/admin/slots', slotsRoute)
  .route('/api/admin/reservations', reservationsRoute)
  .route('/api/admin/settings', settingsRoute)
  .route('/api/admin/devices', devicesRoute)
  .route('/api/admin/logs', logsRoute)

export default app

/** クライアント (hono/client) 用の型 */
export type AppType = typeof routes
