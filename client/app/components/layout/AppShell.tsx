import { type ReactNode, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { css, cx } from 'styled-system/css'
import { Button } from '../ui/Button'
import { CalendarIcon, ClockIcon, HomeIcon, ListIcon, LogOutIcon, SlidersIcon, TabletIcon } from '../ui/Icons'
import { Logo } from './Logo'

/** スマホ幅では先頭3つを下部タブに、残りを「その他」に入れる */
const NAV_ITEMS = [
  { to: '/admin', label: '今日の予約', short: '今日', icon: HomeIcon, end: true },
  { to: '/admin/calendar', label: 'カレンダー', short: 'カレンダー', icon: CalendarIcon, end: false },
  { to: '/admin/templates', label: 'コマのひな形', short: 'ひな形', icon: ClockIcon, end: false },
  { to: '/admin/settings', label: '全体設定', short: '設定', icon: SlidersIcon, end: false },
  { to: '/admin/devices', label: '受付端末', short: '端末', icon: TabletIcon, end: false },
  { to: '/admin/logs', label: '操作ログ', short: 'ログ', icon: ListIcon, end: false },
]
const TAB_ITEMS = NAV_ITEMS.slice(0, 3)
const MORE_ITEMS = NAV_ITEMS.slice(3)

const navLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'sm',
  px: 'md',
  py: 'sm',
  flexShrink: 0,
  borderRadius: 'md',
  fontSize: 'sm',
  fontWeight: '500',
  color: 'fg.muted',
  _hover: { bg: 'surface.hover', color: 'fg' },
})
const navLinkActiveStyle = css({
  bg: 'surface.selected',
  color: 'accent.fg',
  fontWeight: '600',
  _hover: { bg: 'surface.selected', color: 'accent.fg' },
})

const tabStyle = css({
  flex: 1,
  minW: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  minH: '56px',
  fontSize: '11px',
  fontWeight: '500',
  color: 'fg.muted',
  bg: 'transparent',
  cursor: 'pointer',
  _hover: { color: 'fg' },
})
const tabActiveStyle = css({ color: 'accent.fg', fontWeight: '600' })

/** スマホ幅の下部タブバー */
function MobileTabBar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.to))

  return (
    <div className={css({ display: { base: 'block', md: 'none' }, position: 'relative', flexShrink: 0 })}>
      {open && (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className={css({ position: 'fixed', inset: 0, zIndex: 10, bg: 'transparent', cursor: 'default' })}
          />
          <div
            className={css({
              position: 'absolute',
              right: 'sm',
              bottom: '100%',
              mb: 'xs',
              zIndex: 11,
              minW: '200px',
              p: 'xs',
              display: 'flex',
              flexDirection: 'column',
              bg: 'surface',
              borderWidth: '1px',
              borderRadius: 'lg',
              shadow: 'island',
            })}
          >
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cx(navLinkStyle, css({ py: 'md' }), isActive && navLinkActiveStyle)}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </>
      )}
      <nav aria-label="メインメニュー" className={css({ display: 'flex', bg: 'sidebar', borderTopWidth: '1px', pb: 'env(safe-area-inset-bottom)' })}>
        {TAB_ITEMS.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(tabStyle, isActive && tabActiveStyle)}>
            <Icon size={22} />
            {short}
          </NavLink>
        ))}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cx(tabStyle, (open || moreActive) && tabActiveStyle)}>
          <SlidersIcon size={22} />
          その他
        </button>
      </nav>
    </div>
  )
}

/** 管理画面の枠（ヘッダー・ナビゲーション・本文） */
export function AppShell({ onLogout, children }: { onLogout: () => void; children: ReactNode }) {
  return (
    <div className={css({ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>
      <header
        className={css({
          h: '56px',
          px: { base: 'md', md: 'lg' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'md',
          bg: 'surface',
          shadow: 'header',
          flexShrink: 0,
        })}
      >
        <Link to="/admin">
          <Logo label="予約 管理" />
        </Link>
        <Button variant="ghost" size="sm" onClick={onLogout} aria-label="ログアウト">
          <LogOutIcon size={16} />
          <span className={css({ display: { base: 'none', md: 'inline' } })}>ログアウト</span>
        </Button>
      </header>

      <main className={css({ flex: 1, display: 'flex', p: { base: 'sm', md: 'lg' }, minH: 0 })}>
        <div
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: { base: 'column', md: 'row' },
            bg: 'surface',
            borderRadius: '2xl',
            shadow: 'island',
            overflow: 'hidden',
          })}
        >
          <nav
            aria-label="メインメニュー"
            className={css({
              display: { base: 'none', md: 'flex' },
              flexDirection: 'column',
              gap: 'xs',
              p: 'sm',
              pt: 'md',
              w: '220px',
              flexShrink: 0,
              bg: 'sidebar',
              borderRightWidth: '1px',
            })}
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(navLinkStyle, isActive && navLinkActiveStyle)}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className={css({ flex: 1, minW: 0, overflowY: 'auto', p: { base: 'md', md: '2xl' } })}>{children}</div>
          <MobileTabBar />
        </div>
      </main>
    </div>
  )
}
