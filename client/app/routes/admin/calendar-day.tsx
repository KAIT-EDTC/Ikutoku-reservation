import { WEEKDAYS, weekday } from '@ikutoku/shared'
import { redirect } from 'react-router'
import { PageHeader } from '~/components/ui/PageHeader'
import { dayAction, loadDay } from '~/features/admin/day-action'
import { DayView, type DayActionData } from '~/features/admin/DayView'
import type { Route } from './+types/calendar-day'

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) throw redirect('/admin/calendar')
  return { date: params.date, day: await loadDay(params.date) }
}

export const clientAction = ({ request }: Route.ClientActionArgs) => dayAction(request)

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

/** A-03: 特定の日のコマの編集・追加・削除と、その日の予約 */
export default function CalendarDayPage({ loaderData, actionData }: Route.ComponentProps) {
  const { date, day } = loaderData
  return (
    <>
      <PageHeader title={`${date}（${WEEKDAYS[weekday(date)]}）`} back={{ to: `/admin/calendar?month=${date.slice(0, 7)}`, label: 'カレンダー' }} />
      <DayView date={date} day={day} actionData={actionData as DayActionData} />
    </>
  )
}
