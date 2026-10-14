import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { ChoiceGrid } from '~/features/kiosk/ChoiceGrid'
import { api, unwrap } from '~/lib/api'
import { formatDate } from '~/lib/format'
import type { Route } from './+types/dates'

export async function clientLoader() {
  return unwrap(api.kiosk.$get({ query: {} }))
}

/** 受付のトップ。受付期間内の日付だけを出す */
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
