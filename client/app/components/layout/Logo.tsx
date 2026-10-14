import { css } from 'styled-system/css'

export function Logo({ label = '予約' }: { label?: string }) {
  return (
    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: 'sm', color: 'fg' })}>
      <img src="/edtc-icon.webp" alt="EDTC" width={32} height={32} className={css({ display: 'block', objectFit: 'contain' })} />
      <span className={css({ fontSize: 'lg', fontWeight: '700', letterSpacing: '-0.02em' })}>{label}</span>
    </span>
  )
}
