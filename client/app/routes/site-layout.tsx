import { Outlet } from 'react-router'
import { SiteShell } from '~/components/layout/SiteShell'
import type { Route } from './+types/site-layout'

// ポスターの UD丸ゴ_ラージ・UD角ゴ_ラージ の代わり（theme/tokens.ts の maru・kaku）
export const links: Route.LinksFunction = () => [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@700&family=Zen+Maru+Gothic:wght@500;700;900&display=swap' }]

export default function SiteLayout() {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  )
}
