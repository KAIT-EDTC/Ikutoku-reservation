import { nowJst } from '@ikutoku/shared'
import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { dayAction, loadDay } from '~/features/admin/day-action'
import { DayView, type DayActionData } from '~/features/admin/DayView'
import { ReservationTable } from '~/features/admin/ReservationTable'
import { api, unwrap } from '~/lib/api'
import { formatDate, formatTimes } from '~/lib/format'
import type { Route } from './+types/today'

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const date = nowJst().date
  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase() ?? ''
  const [day, search] = await Promise.all([loadDay(date), code ? unwrap(api.admin.reservations.$get({ query: { code } })) : null])
  return { date, day, code, found: search?.found ?? null }
}

export const clientAction = ({ request }: Route.ClientActionArgs) => dayAction(request)

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

/** 当日の受付確認（A-06）。予約番号で検索して照合・取消できる */
export default function TodayPage({ loaderData, actionData }: Route.ComponentProps) {
  const { date, day, code, found } = loaderData
  return (
    <>
      <PageHeader title={`今日（${formatDate(date)}）の予約`} />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
        <Card title="予約番号で検索">
          <Form method="get" className={css({ display: 'flex', alignItems: 'flex-end', gap: 'sm' })}>
            <TextField label="予約番号" name="code" defaultValue={code} autoCapitalize="characters" className={css({ w: '160px' })} />
            <Button type="submit">検索</Button>
          </Form>
          {code && (
            <div className={css({ mt: 'md' })}>
              {found ? (
                <>
                  <p className={css({ mb: 'sm', fontWeight: '600' })}>
                    {formatDate(found.date)} {formatTimes(found)}
                  </p>
                  <ReservationTable rows={[found]} />
                </>
              ) : (
                <Alert tone="warning">予約番号 {code} は見つかりません。</Alert>
              )}
            </div>
          )}
        </Card>
        <DayView date={date} day={day} actionData={actionData as DayActionData} />
      </div>
    </>
  )
}
