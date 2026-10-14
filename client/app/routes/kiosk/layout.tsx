import { Outlet } from 'react-router'
import { KioskShell } from '~/components/layout/KioskShell'
import type { Route } from './+types/layout'

export const meta: Route.MetaFunction = () => [{ title: '予約受付' }, { name: 'robots', content: 'noindex' }]

export default function KioskLayout() {
  return (
    <KioskShell>
      <Outlet />
    </KioskShell>
  )
}
