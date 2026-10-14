import type { ReactNode } from 'react'
import { css } from 'styled-system/css'

/** 受付端末の枠。ナビゲーションは出さず、文字とボタンを大きくする（非機能要件: 44pt以上・1画面1操作） */
export function KioskShell({ children }: { children: ReactNode }) {
  return (
    <main className={css({ minH: '100vh', p: { base: 'md', md: 'xl' }, display: 'flex', justifyContent: 'center' })}>
      <div className={css({ w: 'full', maxW: '960px', p: { base: 'lg', md: '2xl' }, bg: 'surface', borderRadius: '2xl', shadow: 'island', fontSize: 'xl' })}>
        {children}
      </div>
    </main>
  )
}
