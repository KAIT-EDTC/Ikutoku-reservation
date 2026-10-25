import { nowJst, SLOT_STATUS_LABELS } from '@ikutoku/shared'
import { redirect } from 'react-router'
import { css } from 'styled-system/css'
import { ButtonLink } from '~/components/ui/Button'
import { ChoiceGrid } from '~/features/kiosk/ChoiceGrid'
import { useIdleReset } from '~/features/kiosk/use-idle-reset'
import { api, unwrap } from '~/lib/api'
import { formatDate, formatTimes } from '~/lib/format'
import type { Route } from './+types/slots'

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) throw redirect('/kiosk')
  return { date: params.date, ...(await unwrap(api.kiosk.$get({ query: { date: params.date } }))) }
}

/** コマを選ぶ。満員・受付停止のコマはグレーで選べない（F-02） */
export default function KioskSlotsPage({ loaderData }: Route.ComponentProps) {
  const { date, slots, resetSeconds } = loaderData
  useIdleReset(resetSeconds)
  return (
    <>
      <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>{formatDate(date)} の時間を選んでください</h1>
      <ChoiceGrid
        choices={slots.map((sl) => ({
          key: sl.id,
          label: formatTimes(sl),
          sub: sl.bookable ? `残り${sl.remaining}名` : sl.status === 'full' ? '満員' : SLOT_STATUS_LABELS[sl.status],
          to: sl.bookable ? `/kiosk/${date}/${sl.id}` : undefined,
        }))}
      />
      {/* 当日の日付は /kiosk から自動で開くので、戻ると元の画面に戻ってしまう。当日以外のときだけ出す */}
      {date !== nowJst().date && (
        <ButtonLink to="/kiosk" size="xl" block>
          ← 日付を選び直す
        </ButtonLink>
      )}
    </>
  )
}
