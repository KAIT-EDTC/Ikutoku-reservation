import type { D1Database } from '@cloudflare/workers-types'

// クライアントが AppType を型importする際にも解決できるよう、グローバル型に頼らず明示的にimportする
export type Bindings = {
  DB: D1Database
  /** フロントエンドのURL（CORS・CSRFで許可するオリジン） */
  FRONTEND_URL: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: {
    /** requireAdmin を通ったリクエストの管理者ID */
    adminId: number
    /** requireDevice を通ったリクエストの受付端末ID */
    deviceId: number
  }
}
