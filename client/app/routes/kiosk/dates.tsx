import { nowJst } from '@ikutoku/shared'
import { redirect } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { ChoiceGrid } from '~/features/kiosk/ChoiceGrid'
import { api, unwrap } from '~/lib/api'
import { formatDate } from '~/lib/format'
import type { Route } from './+types/dates'

export async function clientLoader() {
  const data = await unwrap(api.kiosk.$get({ query: {} }))
  // 当日が開催日なら日付選択を飛ばして当日のコマを出す
  const today = nowJst().date
  if (data.dates.includes(today)) throw redirect(`/kiosk/${today}`)
  return data
}

/** 受付のトップ。当日が開催日なら当日のコマへ進み、そうでなければ受付期間内の日付だけを出す */
export default function KioskDatesPage({ loaderData }: Route.ComponentProps) {
  const { notice, dates } = loaderData
  return (
    <>
      {notice && <Alert tone="info">{notice}</Alert>}
      <h1 className={css({ mt: 'md', fontSize: '3xl', fontWeight: '700' })}>ご予約の日付を選んでください</h1>
      <ChoiceGrid choices={dates.map((d) => ({ key: d, label: formatDate(d), to: `/kiosk/${d}` }))} />
      {!dates.length && <p className={css({ color: 'fg.muted' })}>現在受付中の日付はありません。</p>}
    </>
  )
}
