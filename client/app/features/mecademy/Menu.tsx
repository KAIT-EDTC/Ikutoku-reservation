import { PRODUCTS, type ProductId } from '@ikutoku/shared'
import { useState } from 'react'
import { css } from 'styled-system/css'
import { Availability, type PublicSlot } from './Availability'
import { PRODUCT_CONTENT } from './content'
import { actionRaw, boxRaw, labelRaw, paperRaw } from './styles'

/** ポスター裏面: おしながき（体験ごとの説明と空き状況）・注意書き・予約のしかた */
export function Menu({ published, slots }: { published: boolean; slots: PublicSlot[] }) {
  return (
    <section id="oshinagaki" aria-labelledby="oshinagaki-title" className={css(paperRaw, { scrollMarginTop: '16px' })}>
      <img src="/mecademy/waves-top.svg" alt="" className={css({ position: 'absolute', top: 0, left: 0, w: 'full', h: 'auto', pointerEvents: 'none' })} />
      <div className={css({ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 20px' })}>
        <h2 id="oshinagaki-title">
          <img src="/mecademy/oshinagaki.svg" alt="おしながき" width={256} height={64} className={css({ display: 'block', w: { base: '200px', md: '280px' }, h: 'auto' })} />
        </h2>
        <p
          className={css({
            px: { base: '14px', md: '22px' },
            py: { base: '6px', md: '8px' },
            bg: 'poster.red',
            color: 'white',
            fontFamily: 'kaku',
            fontSize: { base: 'xl', md: '3xl' },
            fontWeight: '700',
            letterSpacing: '0.04em',
          })}
        >
          事前予約推奨！
        </p>
      </div>

      <div className={css({ position: 'relative', mt: { base: '20px', md: '32px' }, display: 'flex', flexDirection: 'column', gap: { base: '24px', md: '32px' } })}>
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} id={p.id} name={p.name} published={published} slots={slots.filter((s) => s.product === p.id)} />
        ))}
      </div>

      <div className={css({ mt: { base: '24px', md: '32px' }, display: 'grid', gridTemplateColumns: { base: '1fr', md: '1fr 1.3fr' }, gap: { base: '20px', md: '28px' }, alignItems: 'start' })}>
        <p className={css(boxRaw, { p: { base: '16px', md: '20px 24px' }, fontWeight: '700', lineHeight: '1.8', wordBreak: 'auto-phrase' })}>
          未就学児と小学校低学年のお子さまが参加される場合は、安全のため必ず保護者同伴のうえでご参加ください！
        </p>
        <Guide />
      </div>
    </section>
  )
}

function ProductCard({ id, name, published, slots }: { id: ProductId; name: string; published: boolean; slots: PublicSlot[] }) {
  const c = PRODUCT_CONTENT[id]
  const [open, setOpen] = useState(false)
  const panelId = `availability-${id}`
  return (
    <article
      aria-labelledby={`product-${id}`}
      className={css(boxRaw, {
        pt: { base: '26px', md: '34px' },
        px: { base: '16px', md: '28px' },
        pb: { base: '18px', md: '24px' },
        _before: {
          content: '""',
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '4px',
          h: '10px',
          backgroundImage: 'repeating-linear-gradient(45deg, var(--colors-poster-teal) 0 5px, transparent 5px 10px)',
        },
      })}
    >
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: '1fr 36%' },
          gridTemplateAreas: { base: '"head" "photo" "price" "body" "tags"', md: '"head photo" "body photo" "tags price"' },
          gridTemplateRows: { md: 'auto 1fr auto' },
          columnGap: '28px',
          rowGap: { base: '12px', md: '14px' },
          alignItems: 'start',
        })}
      >
        <div className={css({ gridArea: 'head', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 20px' })}>
          <h3
            id={`product-${id}`}
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: '900',
              color: 'poster.text',
              lineHeight: '1.3',
              backgroundImage: 'linear-gradient(transparent 62%, var(--colors-poster-teal) 62%)',
              pr: '8px',
            })}
          >
            {name}
          </h3>
          {c.takeHome && (
            <span className={css(labelRaw, { h: '32px', fontSize: { base: 'md', md: 'lg' } })}>
              <BagIcon />
              持ち帰りOK！
            </span>
          )}
        </div>
        <p className={css({ gridArea: 'body', fontSize: { base: 'md', md: 'lg' }, fontWeight: '500', lineHeight: '1.8', wordBreak: 'auto-phrase' })}>{c.description}</p>
        <dl className={css({ gridArea: 'tags', display: 'flex', alignSelf: 'end' })}>
          <dt className={css(labelRaw, { h: '42px', fontSize: { base: 'md', md: 'lg' } })}>対象年齢</dt>
          <dd
            className={css({
              display: 'flex',
              alignItems: 'center',
              h: '42px',
              px: '14px',
              bg: 'white',
              borderWidth: '2px',
              borderLeftWidth: 0,
              borderColor: 'poster.teal',
              fontSize: { base: 'lg', md: 'xl' },
              fontWeight: '700',
            })}
          >
            {c.age}
          </dd>
        </dl>
        <img
          src={c.photo.src}
          alt={c.photo.alt}
          width={960}
          height={720}
          loading="lazy"
          className={css({ gridArea: 'photo', display: 'block', w: 'full', h: 'auto', aspectRatio: '4 / 3', objectFit: 'cover' })}
        />
        <p className={css({ gridArea: 'price', textAlign: 'center', color: 'poster.red', fontWeight: '900', lineHeight: '1.1' })}>
          {c.price === null ? (
            <span className={css({ fontFamily: 'kaku', fontSize: { base: '3xl', md: '4xl' } })}>体験無料！</span>
          ) : (
            <>
              <span className={css({ fontSize: { base: '4xl', md: '5xl' }, letterSpacing: '0.01em' })}>{c.price}</span>
              <span className={css({ fontSize: { base: 'xl', md: '2xl' } })}>円</span>
            </>
          )}
        </p>
      </div>

      <div className={css({ mt: { base: '16px', md: '20px' } })}>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className={css(actionRaw, { w: { base: 'full', md: 'auto' } })}>
          {open ? '空き状況を閉じる' : '空き状況を見る'}
          <Chevron up={open} />
        </button>
        {open && <Availability id={panelId} published={published} slots={slots} />}
      </div>
    </article>
  )
}

function Guide() {
  return (
    <section id="guide" aria-labelledby="guide-title" className={css(boxRaw, { scrollMarginTop: '16px', p: { base: '16px', md: '20px 24px' }, bg: 'poster.orange' })}>
      <h2 id="guide-title" className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: '900', color: 'poster.text' })}>
        予約のしかた
      </h2>
      <ol
        className={css({
          mt: '8px',
          pl: '1.4em',
          listStyle: 'decimal',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: { base: 'sm', md: 'md' },
          fontWeight: '700',
          lineHeight: '1.7',
          wordBreak: 'auto-phrase',
        })}
      >
        <li>予約は会場の受付端末で行います。このページでは空き状況を確認できます。</li>
        <li>受付端末で「日付 → 体験と時間 → 人数 → 確認」の順に選ぶと、予約番号が表示されます。</li>
        <li>予約番号は画面を撮影して控えてください。スマホがない方にはスタッフが紙に書いてお渡しします。</li>
        <li>お名前や連絡先はお伺いしません。予約の取消・変更は、予約番号をスタッフにお伝えください。</li>
        <li>中止や変更は、このページのお知らせでお知らせします。ご来場前にご確認ください。</li>
      </ol>
    </section>
  )
}

function BagIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M9 3h6a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2zm0 3h6V5H9v1zM7 9v8h2V9H7zm8 0v8h2V9h-2z" />
    </svg>
  )
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={css({ transition: 'transform 0.2s' })}
      style={{ transform: up ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
