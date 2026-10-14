import { css } from 'styled-system/css'
import { PageHeader } from '~/components/ui/PageHeader'
import { api, unwrap } from '~/lib/api'
import type { Route } from './+types/logs'

export async function clientLoader() {
  return unwrap(api.admin.logs.$get())
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

const ACTIONS: Record<string, string> = {
  reserve: '予約',
  reserve_overbook: '予約（定員超過許可）',
  cancel: '予約取消',
  login: 'ログイン',
  login_failed: 'ログイン失敗',
  slot_create: 'コマ追加',
  slot_update: 'コマ編集',
  slot_delete: 'コマ削除',
  slot_stop: 'コマ受付停止',
  slot_resume: 'コマ受付再開',
  template_create: 'ひな形追加',
  template_delete: 'ひな形削除',
  blackout_create: '受付不可追加',
  blackout_delete: '受付不可削除',
  settings_update: '全体設定変更',
  otp_reset: '認証アプリ再発行',
  device_register: '端末登録',
  device_rename: '端末名変更',
  device_disable: '端末無効化',
  device_enable: '端末有効化',
}

const cell = css({ px: 'sm', py: 'xs', textAlign: 'left', fontSize: 'sm', borderBottomWidth: '1px' })

/** A-10: いつ・どの端末/管理者が・何をしたか */
export default function LogsPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="操作ログ" description="直近500件" />
      <div className={css({ overflowX: 'auto' })}>
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ color: 'fg.muted' })}>
              <th className={cell}>日時</th>
              <th className={cell}>操作者</th>
              <th className={cell}>操作</th>
              <th className={cell}>対象ID</th>
            </tr>
          </thead>
          <tbody>
            {loaderData.logs.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{r.at}</td>
                <td className={cell}>{r.actorType === 'device' ? `端末: ${r.deviceName}` : r.actorType === 'admin' ? `管理者: ${r.loginId}` : '—'}</td>
                <td className={cell}>{ACTIONS[r.action] ?? r.action}</td>
                <td className={cell}>{r.targetId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
