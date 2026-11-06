import { nowJst, SLOT_STATUS_LABELS, type ProductId, type SlotStatus } from '@ikutoku/shared'
import { useState } from 'react'
import { css, cva } from 'styled-system/css'
import { formatDate, formatTimes } from '~/lib/format'

export type PublicSlot = { id: number; date: string; product: ProductId; startTime: string; endTime: string; status: SlotStatus; remaining: number; bookable: boolean }

const markStyle = cva({
  base: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minW: '44px', h: '30px', px: '10px', borderRadius: 'full', fontSize: 'sm', fontWeight: '900', whiteSpace: 'nowrap' },
  variants: {
    status: {
      ok: { bg: 'poster.teal', color: 'white', fontSize: 'lg' },
      few: { bg: 'poster.orange', color: 'poster.ink', fontSize: 'lg' },
      full: { bg: 'poster.red', color: 'white', fontSize: 'lg' },
      stopped: { bg: '#e7e5e1', color: '#6b6560' },
      ended: { bg: '#e7e5e1', color: '#6b6560' },
    },
  },
})

const tabStyle = cva({
  base: {
    h: '38px',
    px: '16px',
    fontSize: 'md',
    fontWeight: '700',
    borderWidth: '2px',
    borderColor: 'poster.ink',
    borderRadius: 'full',
    cursor: 'pointer',
    _focusVisible: { outline: '3px solid var(--colors-poster-orange)', outlineOffset: '2px' },
  },
  variants: {
    active: { true: { bg: 'poster.ink', color: 'white' }, false: { bg: 'white', color: 'poster.ink', _hover: { bg: 'poster.paper' } } },
  },
})

/** 1つの体験の空き状況（F-01）。見るだけで、予約は会場の受付端末で行う */
export function Availability({ id, published, slots }: { id: string; published: boolean; slots: PublicSlot[] }) {
  const dates = [...new Set(slots.map((s) => s.date))]
  const [picked, setPicked] = useState<string>()
  const date = picked ?? dates.find((d) => d >= nowJst().date) ?? dates[0]
  const shown = slots.filter((s) => s.date === date)

  return (
    <div id={id} className={css({ mt: '16px', p: { base: '14px', md: '20px' }, wordBreak: 'auto-phrase', bg: 'white', borderWidth: '2px', borderColor: 'poster.teal', borderRadius: '10px' })}>
      {!published ? (
        <p className={css({ fontWeight: '700' })}>
          予約の受付はまだ始まっていません。
          <br />
          公開までしばらくお待ちください。
        </p>
      ) : !dates.length ? (
        <p className={css({ fontWeight: '700' })}>表示できる時間帯がありません。</p>
      ) : (
        <>
          {dates.length > 1 && (
            <div role="group" aria-label="日付" className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px', mb: '14px' })}>
              {dates.map((d) => (
                <button key={d} type="button" aria-pressed={d === date} onClick={() => setPicked(d)} className={tabStyle({ active: d === date })}>
                  {formatDate(d)}
                </button>
              ))}
            </div>
          )}
          {dates.length === 1 && <p className={css({ mb: '10px', fontWeight: '700' })}>{formatDate(date)}</p>}
          <ul className={css({ display: 'flex', flexDirection: 'column' })}>
            {shown.map((s) => (
              <li key={s.id} className={css({ display: 'flex', alignItems: 'center', gap: '12px', py: '10px', '&:not(:first-child)': { borderTopWidth: '1px', borderColor: 'poster.grid' } })}>
                <span className={css({ flex: 1, fontSize: { base: 'lg', md: 'xl' }, fontWeight: '700', fontVariantNumeric: 'tabular-nums' })}>{formatTimes(s)}</span>
                {s.bookable && <span className={css({ fontSize: 'sm', color: '#5c5650' })}>残り{s.remaining}名</span>}
                <span className={markStyle({ status: s.status })}>{SLOT_STATUS_LABELS[s.status]}</span>
              </li>
            ))}
          </ul>
          <p className={css({ mt: '10px', fontSize: 'xs', color: '#5c5650' })}>○ 余裕あり ／ △ 残りわずか ／ × 満員</p>
        </>
      )}
      <p className={css({ mt: '10px', pt: '10px', borderTopWidth: '1px', borderColor: 'poster.grid', fontSize: 'sm', fontWeight: '700' })}>
        予約は会場の受付で行います。
        <a href="#guide" className={css({ display: 'inline-block', ml: '4px', color: 'poster.ink', textDecoration: 'underline', textUnderlineOffset: '3px', _hover: { color: 'poster.red' } })}>
          予約のしかた
        </a>
      </p>
    </div>
  )
}
