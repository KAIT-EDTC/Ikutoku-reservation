import { Outlet } from 'react-router'
import { AppShell } from '~/components/layout/AppShell'
import { useLogout } from '~/features/auth/use-logout'
import { api, unwrap } from '~/lib/api'
import type { Route } from './+types/layout'

export const meta: Route.MetaFunction = () => [{ title: '管理 | 予約' }, { name: 'robots', content: 'noindex' }]

/** 未ログインなら unwrap が /admin/login へリダイレクトする */
export async function clientLoader() {
  return unwrap(api.auth.me.$get())
}

export default function AdminLayout() {
  const logout = useLogout()
  return (
    <AppShell onLogout={logout}>
      <Outlet />
    </AppShell>
  )
}
