import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'

const choiceStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'xs',
  minH: '112px',
  p: 'md',
  fontSize: '2xl',
  fontWeight: '600',
  color: 'fg',
  bg: 'surface',
  borderWidth: '2px',
  borderColor: 'accent',
  borderRadius: 'xl',
  transition: 'background 0.15s',
  _hover: { bg: 'accent.subtle', color: 'fg' },
})
const disabledStyle = css({ borderColor: 'border', bg: 'surface.muted', color: 'fg.subtle', _hover: { bg: 'surface.muted', color: 'fg.subtle' } })
const subStyle = css({ fontSize: 'md', fontWeight: '500', color: 'fg.muted' })

export type Choice = { key: string | number; label: ReactNode; sub?: ReactNode; to?: string }

/** 受付端末の大きな選択ボタン。to が無いものはグレーで選べない（F-02） */
export function ChoiceGrid({ choices }: { choices: Choice[] }) {
  return (
    <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'md', my: 'lg' })}>
      {choices.map((c) =>
        c.to ? (
          <Link key={c.key} to={c.to} className={choiceStyle}>
            {c.label}
            {c.sub && <span className={subStyle}>{c.sub}</span>}
          </Link>
        ) : (
          <span key={c.key} aria-disabled="true" className={cx(choiceStyle, disabledStyle)}>
            {c.label}
            {c.sub && <span className={subStyle}>{c.sub}</span>}
          </span>
        ),
      )}
    </div>
  )
}
