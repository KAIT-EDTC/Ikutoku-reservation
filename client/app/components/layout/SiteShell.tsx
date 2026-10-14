import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { css, cx } from 'styled-system/css'
import { Logo } from './Logo'

const linkStyle = css({ px: 'sm', py: 'xs', borderRadius: 'md', fontSize: 'sm', fontWeight: '500', color: 'fg.muted', _hover: { color: 'fg', bg: 'surface.muted' } })
const activeStyle = css({ color: 'accent.fg', fontWeight: '600' })

/** 公開ページ（空き状況・利用案内・お知らせ）の枠。予約や管理への入口は置かない */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className={css({ minH: '100vh', display: 'flex', flexDirection: 'column' })}>
      <header className={css({ h: '56px', px: { base: 'md', md: 'lg' }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'md', bg: 'surface', shadow: 'header' })}>
        <Link to="/">
          <Logo label="予約空き状況" />
        </Link>
        <nav className={css({ display: 'flex', gap: 'xs' })}>
          <NavLink to="/guide" className={({ isActive }) => cx(linkStyle, isActive && activeStyle)}>
            利用案内
          </NavLink>
          <NavLink to="/news" className={({ isActive }) => cx(linkStyle, isActive && activeStyle)}>
            お知らせ
          </NavLink>
        </nav>
      </header>
      <main className={css({ flex: 1, w: 'full', maxW: '880px', mx: 'auto', p: { base: 'sm', md: 'lg' } })}>
        <div className={css({ p: { base: 'md', md: '2xl' }, bg: 'surface', borderRadius: '2xl', shadow: 'island', animation: 'fadeInUp 0.4s ease' })}>{children}</div>
      </main>
    </div>
  )
}
