import { Outlet } from 'react-router'
import { SiteShell } from '~/components/layout/SiteShell'

export default function SiteLayout() {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  )
}
