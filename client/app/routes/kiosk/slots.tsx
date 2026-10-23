import { PRODUCTS, SLOT_STATUS_LABELS } from '@ikutoku/shared'
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

/** 体験ごとに並べたコマから選ぶ。満員・受付停止のコマはグレーで選べない（F-02） */
export default function KioskSlotsPage({ loaderData }: Route.ComponentProps) {
  const { date, slots, resetSeconds } = loaderData
  useIdleReset(resetSeconds)
  return (
    <>
      <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>{formatDate(date)} の体験と時間を選んでください</h1>
      {PRODUCTS.map((p) => ({ ...p, slots: slots.filter((sl) => sl.product === p.id) }))
        .filter((p) => p.slots.length)
        .map((p) => (
          <section key={p.id} className={css({ mt: 'lg' })}>
            <h2 className={css({ fontSize: '2xl', fontWeight: '700' })}>{p.name}</h2>
            <ChoiceGrid
              choices={p.slots.map((sl) => ({
                key: sl.id,
                label: formatTimes(sl),
                sub: sl.bookable ? `残り${sl.remaining}名` : sl.status === 'full' ? '満員' : SLOT_STATUS_LABELS[sl.status],
                to: sl.bookable ? `/kiosk/${date}/${sl.id}` : undefined,
              }))}
            />
          </section>
        ))}
      <ButtonLink to="/kiosk" size="xl" block>
        ← 日付を選び直す
      </ButtonLink>
    </>
  )
}
