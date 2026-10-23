import { css, cva } from 'styled-system/css'

/** ポスターの紙: 方眼のクリーム色、角丸 */
export const paperRaw = css.raw({
  position: 'relative',
  overflow: 'hidden',
  bg: 'poster.paper',
  backgroundImage: 'linear-gradient(var(--colors-poster-grid) 1px, transparent 1px), linear-gradient(90deg, var(--colors-poster-grid) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
  backgroundPosition: '-1px -1px',
  borderRadius: { base: '18px', md: '28px' },
  px: { base: '16px', md: '40px' },
  pt: { base: '20px', md: '36px' },
  pb: { base: '20px', md: '36px' },
})

/** 紺のふちと、右下にずらした紺の影の白い箱（おしながきの各体験・注意書き） */
export const boxRaw = css.raw({
  position: 'relative',
  bg: 'poster.card',
  borderWidth: '2px',
  borderColor: 'poster.ink',
  boxShadow: '5px 5px 0 var(--colors-poster-ink)',
})

/** 水色地に白い角ゴの見出し（対象年齢・持ち帰りOK！） */
export const labelRaw = css.raw({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  px: '10px',
  bg: 'poster.teal',
  color: 'white',
  fontFamily: 'kaku',
  fontWeight: '700',
  whiteSpace: 'nowrap',
})

/** マスキングテープ。両端をギザギザに切る */
export const tapeStyle = cva({
  base: {
    position: 'absolute',
    zIndex: 1,
    w: { base: '56px', md: '84px' },
    h: { base: '18px', md: '24px' },
    opacity: 0.92,
    clipPath: 'polygon(5% 0, 100% 0, 95% 25%, 100% 50%, 95% 75%, 100% 100%, 0 100%, 5% 75%, 0 50%, 5% 25%)',
    pointerEvents: 'none',
  },
  variants: {
    color: { orange: { bg: 'poster.orange' }, teal: { bg: 'poster.teal' } },
    corner: {
      left: { top: { base: '-4px', md: '-2px' }, left: { base: '-18px', md: '-26px' }, transform: 'rotate(-38deg)' },
      right: { top: { base: '-4px', md: '-2px' }, right: { base: '-18px', md: '-26px' }, transform: 'rotate(32deg)' },
    },
  },
})

/** オレンジに紺の文字・紺のふちと影のボタン（ポスターの「予約はコチラ！」の箱） */
export const actionRaw = css.raw({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minH: '48px',
  px: '20px',
  fontSize: { base: 'md', md: 'lg' },
  fontWeight: '900',
  color: 'poster.ink',
  bg: 'poster.orange',
  borderWidth: '2px',
  borderColor: 'poster.ink',
  borderRadius: '10px',
  boxShadow: '3px 3px 0 var(--colors-poster-ink)',
  cursor: 'pointer',
  transition: 'transform 0.1s, box-shadow 0.1s',
  _hover: { color: 'poster.ink', transform: 'translate(1px, 1px)', boxShadow: '2px 2px 0 var(--colors-poster-ink)' },
  _active: { transform: 'translate(3px, 3px)', boxShadow: '0 0 0 var(--colors-poster-ink)' },
  _focusVisible: { outline: '3px solid var(--colors-poster-red)', outlineOffset: '3px' },
})

export const paperStyle = css(paperRaw)
