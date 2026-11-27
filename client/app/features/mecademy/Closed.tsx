import { css } from 'styled-system/css'
import { actionRaw, paperStyle, tapeStyle } from './styles'

const HP_URL = 'https://kaitedtc.com/'

/** 幾徳祭が終わったあとの公開トップ。来場のお礼と来年の案内、EDTCのHPへの入口だけを出す（空き状況はAPIごと読まない） */
export function Closed() {
  return (
    <section className={paperStyle} aria-labelledby="closed-title">
      <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '8px', md: '24px' } })}>
        <div className={css({ flex: '1 1 0', minW: 0 })}>
          <img
            src="/mecademy/title.svg"
            alt="KAIT EDTC メカデミー さわってあそべる！ロボット教室"
            width={348}
            height={166}
            className={css({ display: 'block', w: 'full', maxW: '560px', h: 'auto' })}
          />
        </div>
        <img src="/mecademy/cube.svg" alt="" width={200} height={171} className={css({ flexShrink: 0, w: { base: '30%', md: '220px' }, h: 'auto' })} />
      </div>

      <div className={css({ mt: { base: '20px', md: '32px' }, display: 'grid', gridTemplateColumns: { base: '1fr', md: '1.2fr 1fr' }, gap: { base: '28px', md: '40px' }, alignItems: 'center' })}>
        <div>
          <p
            className={css({
              display: 'inline-block',
              px: { base: '14px', md: '22px' },
              py: { base: '6px', md: '8px' },
              bg: 'poster.red',
              color: 'white',
              fontFamily: 'kaku',
              fontSize: { base: 'lg', md: '2xl' },
              fontWeight: '700',
              letterSpacing: '0.04em',
            })}
          >
            今年のメカデミーは終了しました
          </p>
          <h1
            id="closed-title"
            className={css({ mt: { base: '14px', md: '20px' }, fontSize: { base: '2xl', md: '4xl' }, fontWeight: '900', lineHeight: '1.4', wordBreak: 'auto-phrase' })}
          >
            ご来場
            <wbr />
            ありがとうございました！
          </h1>
          <p className={css({ mt: '12px', fontSize: { base: 'md', md: 'lg' }, fontWeight: '700', lineHeight: '1.9', wordBreak: 'auto-phrase' })}>
            また来年の幾徳祭でお会いしましょう！
            <br />
            それまでのEDTCの活動は、ホームページでお知らせしています。
          </p>
          <a
            href={HP_URL}
            target="_blank"
            rel="noopener"
            className={css(actionRaw, { mt: { base: '18px', md: '24px' }, w: { base: 'full', sm: 'auto' }, justifyContent: 'space-between', gap: '16px', p: { base: '14px 18px', md: '18px 28px' }, fontSize: { base: 'lg', md: '2xl' } })}
          >
            <span>
              EDTCのHPはコチラ
              <span className={css({ display: 'inline-block', ml: '4px', transform: 'skewX(-12deg)' })}>！</span>
            </span>
            <ExternalIcon />
          </a>
        </div>
        <figure className={css({ position: 'relative', px: { base: '14px', md: '12px' }, pt: '6px' })}>
          <span className={tapeStyle({ color: 'orange', corner: 'left' })} />
          <span className={tapeStyle({ color: 'teal', corner: 'right' })} />
          <img
            src="/mecademy/venue-1.webp"
            alt="メカデミーの様子"
            width={1200}
            height={900}
            className={css({ display: 'block', w: 'full', h: 'auto', aspectRatio: '4 / 3', objectFit: 'cover', boxShadow: '0 2px 6px rgba(44, 52, 86, 0.18)' })}
          />
        </figure>
      </div>

      <img
        src="/mecademy/waves-bottom.svg"
        alt=""
        className={css({
          display: 'block',
          w: { base: 'calc(100% + 32px)', md: 'calc(100% + 80px)' },
          maxW: 'none',
          h: 'auto',
          ml: '-60px',
          mb: { base: '-20px', md: '-36px' },
          mt: { base: '16px', md: '20px' },
        })}
      />
    </section>
  )
}

function ExternalIcon() {
  return (
    <svg
      aria-label="新しいタブで開く"
      role="img"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={css({ flexShrink: 0 })}
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
