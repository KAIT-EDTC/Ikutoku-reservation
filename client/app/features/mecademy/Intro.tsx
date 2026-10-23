import { css } from 'styled-system/css'
import { actionRaw, paperStyle, tapeStyle } from './styles'

const sheetHeading = css.raw({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: '700', color: 'poster.text', letterSpacing: '0.02em' })
const sheetText = css({ mt: '10px', fontSize: { base: 'sm', md: 'md' }, lineHeight: '1.9', wordBreak: 'auto-phrase' })

/** ポスター表面: タイトル・メカデミーの説明・会場の写真 */
export function Intro() {
  return (
    <section className={paperStyle} aria-labelledby="mecademy-title">
      <div className={css({ display: 'flex', alignItems: 'center', gap: { base: '8px', md: '24px' } })}>
        <h1 id="mecademy-title" className={css({ flex: '1 1 0', minW: 0 })}>
          <img
            src="/mecademy/title.svg"
            alt="KAIT EDTC メカデミー さわってあそべる！ロボット教室"
            width={348}
            height={166}
            className={css({ display: 'block', w: 'full', maxW: '560px', h: 'auto' })}
          />
        </h1>
        <img src="/mecademy/cube.svg" alt="" width={200} height={171} className={css({ flexShrink: 0, w: { base: '30%', md: '220px' }, h: 'auto' })} />
      </div>

      <div className={css({ mt: { base: '20px', md: '36px' }, display: 'grid', gridTemplateColumns: { base: '1fr', md: '1fr 1fr' }, gap: { base: '28px', md: '40px' }, alignItems: 'start' })}>
        <Clipboard />
        <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: '1fr 1fr', md: '1fr' }, gap: { base: '28px', md: '36px' }, px: { base: '14px', md: '12px' }, pt: '6px' })}>
          <Photo src="/mecademy/venue-1.webp" tapes={['orange', 'teal']} />
          <Photo src="/mecademy/venue-2.webp" tapes={['teal', 'orange']} />
        </div>
      </div>

      <img
        src="/mecademy/waves-bottom.svg"
        alt=""
        className={css({
          display: 'block',
          w: { base: 'calc(100% + 32px)', md: 'calc(100% + 80px)' },
          maxW: 'none',
          h: 'auto',
          mx: { base: '-16px', md: '-40px' },
          mb: { base: '-20px', md: '-36px' },
          mt: { base: '8px', md: '0' },
        })}
      />
    </section>
  )
}

/** ポスターのクリップボード。茶色の板に白い紙と金具 */
function Clipboard() {
  return (
    <div className={css({ position: 'relative', mt: '10px', p: { base: '10px', md: '14px' }, pt: { base: '18px', md: '22px' }, bg: 'poster.clip', borderRadius: '12px' })}>
      <div
        aria-hidden
        className={css({
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          w: '42%',
          h: '24px',
          bg: '#dcdcdc',
          borderRadius: '3px',
          borderBottom: '4px solid #333231',
          boxShadow: 'inset 0 -6px 0 #f4f4f4',
        })}
      />
      <div className={css({ position: 'relative', bg: '#f9f9f9', borderRadius: '3px', px: { base: '18px', md: '28px' }, pt: { base: '22px', md: '32px' }, pb: { base: '56px', md: '64px' } })}>
        <h2 className={css(sheetHeading)}>メカデミーでは…</h2>
        <p className={sheetText}>プログラミング無料体験の他に、ロボットの組み立て授業も開催！授業で作ったロボットは持ち帰れるので、ご家庭でもお楽しみいただけます！</p>
        <h2 className={css(sheetHeading, { mt: '24px' })}>EDTCのポイント</h2>
        <p className={sheetText}>EDTCでは、授業で使うロボットや授業資料をすべてメンバーが作成！説明がわかりやすいので、誰でも楽しくロボットのことを学べます！</p>
        <span
          aria-hidden
          className={css({ position: 'absolute', right: '14px', bottom: '14px', display: 'block', w: '44px', h: '44px', p: '4px', borderWidth: '2px', borderColor: 'poster.red', borderRadius: '2px' })}
        >
          <img src="/mecademy/cube-red.svg" alt="" className={css({ w: 'full', h: 'full', objectFit: 'contain' })} />
        </span>
      </div>
    </div>
  )
}

function Photo({ src, tapes }: { src: string; tapes: ['orange' | 'teal', 'orange' | 'teal'] }) {
  return (
    <figure className={css({ position: 'relative' })}>
      <span className={tapeStyle({ color: tapes[0], corner: 'left' })} />
      <span className={tapeStyle({ color: tapes[1], corner: 'right' })} />
      <img
        src={src}
        alt="体験の様子"
        width={1200}
        height={900}
        loading="lazy"
        className={css({ display: 'block', w: 'full', h: 'auto', aspectRatio: '4 / 3', objectFit: 'cover', boxShadow: '0 2px 6px rgba(44, 52, 86, 0.18)' })}
      />
    </figure>
  )
}

/** ポスター表面の下段: 会場の地図と時間、EDTCのHP、おしながきへの入口 */
export function Venue() {
  return (
    <section aria-label="会場" className={css({ display: 'grid', gridTemplateColumns: { base: '1fr', md: '1.75fr 1fr' }, gap: { base: '16px', md: '24px' }, alignItems: 'stretch' })}>
      <img
        src="/mecademy/board.svg"
        alt="KAIT工房でやってます！ 時間 10:00〜16:30。黒板の地図で、入口からKAIT工房までの道順を示しています。"
        width={345}
        height={191}
        className={css({ display: 'block', w: 'full', h: 'auto', filter: 'drop-shadow(0 3px 0 rgba(44, 52, 86, 0.25))' })}
      />
      <div className={css({ display: 'grid', gridTemplateColumns: { base: '1fr 1fr', md: '1fr' }, gap: { base: '12px', md: '16px' } })}>
        <a
          href="https://kaitedtc.com/"
          target="_blank"
          rel="noopener"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            p: { base: '14px', md: '20px 24px' },
            bg: 'white',
            color: 'poster.text',
            borderRadius: '8px',
            fontSize: { base: 'lg', md: '2xl' },
            fontWeight: '900',
            lineHeight: '1.3',
            transition: 'transform 0.1s',
            _hover: { color: 'poster.text', transform: 'translateY(-2px)' },
            _focusVisible: { outline: '3px solid var(--colors-poster-orange)', outlineOffset: '3px' },
          })}
        >
          <span>
            EDTCの
            <br />
            HPはコチラ
            <Exclaim />
          </span>
          <ExternalIcon />
        </a>
        <a
          href="#oshinagaki"
          className={css(actionRaw, { justifyContent: 'space-between', h: 'full', p: { base: '14px', md: '20px 24px' }, fontSize: { base: 'lg', md: '2xl' }, lineHeight: '1.3', textAlign: 'left' })}
        >
          <span>
            空き状況は
            <br />
            コチラ
            <Exclaim />
          </span>
          <DownIcon />
        </a>
      </div>
    </section>
  )
}

/** ポスターの斜めの「！」 */
function Exclaim() {
  return <span className={css({ display: 'inline-block', ml: '4px', transform: 'skewX(-12deg)' })}>！</span>
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

function DownIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={css({ flexShrink: 0 })}>
      <path d="M12 4v15M5 12l7 7 7-7" />
    </svg>
  )
}
