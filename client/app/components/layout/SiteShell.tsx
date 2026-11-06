import type { ReactNode } from 'react'
import { css } from 'styled-system/css'

/** 公開ページの枠。ポスターと同じ水色のストライプの上に、紙を縦に並べる。予約や管理への入口は置かない */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        minH: '100vh',
        bg: 'poster.teal',
        backgroundImage: 'repeating-linear-gradient(45deg, var(--colors-poster-teal) 0 14px, var(--colors-poster-teal-light) 14px 28px)',
        fontFamily: 'maru',
        fontWeight: '500',
        color: 'poster.text',
        px: { base: '10px', md: '24px' },
        py: { base: '12px', md: '32px' },
      })}
    >
      <main className={css({ maxW: '980px', mx: 'auto', display: 'flex', flexDirection: 'column', gap: { base: '16px', md: '28px' } })}>{children}</main>
    </div>
  )
}
