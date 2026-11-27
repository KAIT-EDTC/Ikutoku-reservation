import { useEffect } from 'react'
import { useRevalidator } from 'react-router'
import { css } from 'styled-system/css'
import { Closed } from '~/features/mecademy/Closed'
import { Intro, Venue } from '~/features/mecademy/Intro'
import { Menu } from '~/features/mecademy/Menu'
import { boxRaw } from '~/features/mecademy/styles'
import { api, unwrap } from '~/lib/api'
import type { Route } from './+types/home'

/**
 * 幾徳祭が終わった期間は true。トップは終了のお知らせとEDTCのHPへの入口だけになり、空き状況のAPIも呼ばない。
 * 来年の準備を始めるときに false に戻す（ポスターの内容・おしながきは Intro / Menu にそのまま残してある）
 */
const FESTIVAL_CLOSED = true

export const meta: Route.MetaFunction = () =>
  FESTIVAL_CLOSED
    ? [
        { title: 'KAIT EDTC メカデミー | また来年の幾徳祭で！' },
        { name: 'description', content: 'EDTCのロボット教室「メカデミー」は今年の幾徳祭での開催を終了しました。ご来場ありがとうございました。' },
      ]
    : [
        { title: 'KAIT EDTC メカデミー | さわってあそべる！ロボット教室' },
        { name: 'description', content: 'KAIT工房で開催するEDTCのロボット教室「メカデミー」。体験の内容と予約の空き状況。' },
      ]

export async function clientLoader() {
  if (FESTIVAL_CLOSED) return null
  return unwrap(api.public.$get())
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

/** 公開トップ: ポスターの内容と、体験ごとの空き状況（F-01）。予約は会場の受付端末で行う */
export default function HomePage({ loaderData }: Route.ComponentProps) {
  if (!loaderData) return <Closed />
  return <Open {...loaderData} />
}

function Open({ published, notice, slots }: NonNullable<Route.ComponentProps['loaderData']>) {
  const { revalidate } = useRevalidator()

  // スマホで開きっぱなしにしたページに戻ってきたら、空き状況を読み直す
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && revalidate()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [revalidate])

  return (
    <>
      {notice && (
        <section id="news" aria-labelledby="news-title" className={css(boxRaw, { p: { base: '14px 16px', md: '18px 24px' }, borderRadius: '6px' })}>
          <h2 id="news-title" className={css({ display: 'inline-block', px: '10px', bg: 'poster.red', color: 'white', fontFamily: 'kaku', fontWeight: '700' })}>
            お知らせ
          </h2>
          <p className={css({ mt: '8px', fontWeight: '700', whiteSpace: 'pre-wrap' })}>{notice}</p>
        </section>
      )}
      <Intro />
      <Venue />
      <Menu published={published} slots={slots} />
    </>
  )
}
