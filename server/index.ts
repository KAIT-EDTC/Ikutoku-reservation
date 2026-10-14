import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import type { Env } from './http.ts'
import { orm } from './queries.ts'
import admin from './routes/admin.ts'
import kiosk from './routes/kiosk.ts'
import pub from './routes/public.ts'

const app = new Hono<Env>()
  .basePath('/api')
  .use(csrf())
  .use(async (c, next) => {
    c.set('db', orm(c.env.DB))
    await next()
    c.header('Cache-Control', 'no-store')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'same-origin')
  })
  .route('/public', pub)
  .route('/kiosk', kiosk)
  .route('/admin', admin)

app.onError((e, c) => {
  if (e instanceof HTTPException) return c.json({ error: e.message }, e.status)
  console.error(e)
  return c.json({ error: 'サーバーエラーが発生しました。' }, 500)
})

export type AppType = typeof app
export default app
