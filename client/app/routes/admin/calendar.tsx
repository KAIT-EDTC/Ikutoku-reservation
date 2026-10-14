import { datesBetween, WEEKDAYS, weekday } from '@ikutoku/shared'
import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'
import { ButtonLink } from '~/components/ui/Button'
import { ChevronLeftIcon, ChevronRightIcon } from '~/components/ui/Icons'
import { PageHeader } from '~/components/ui/PageHeader'
import { api, unwrap } from '~/lib/api'
import type { Route } from './+types/calendar'

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const month = new URL(request.url).searchParams.get('month')
  return unwrap(api.admin.slots.calendar.$get({ query: month && /^\d{4}-\d{2}$/.test(month) ? { month } : {} }))
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

const cellStyle = css({ minH: '84px', p: 'xs', fontSize: 'xs', bg: 'surface', borderWidth: '1px', borderRadius: 'md', color: 'fg', _hover: { borderColor: 'accent', color: 'fg' } })

/** 月表示。日付を開くとコマの編集・代理予約・取消ができる */
export default function CalendarPage({ loaderData }: Route.ComponentProps) {
  const { month, openDate, closeDate, days } = loaderData
  const shift = (n: number) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7)
  const first = `${month}-01`
  const dates = datesBetween(first, `${shift(1)}-01`).slice(0, -1)
  return (
    <>
      <PageHeader
        title={`${+month.slice(0, 4)}年${+month.slice(5, 7)}月`}
        description={`受付期間 ${openDate} 〜 ${closeDate}`}
        actions={
          <>
            <ButtonLink to={`?month=${shift(-1)}`} aria-label="前の月">
              <ChevronLeftIcon />
            </ButtonLink>
            <ButtonLink to={`?month=${shift(1)}`} aria-label="次の月">
              <ChevronRightIcon />
            </ButtonLink>
          </>
        }
      />
      <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'xs' })}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={css({ textAlign: 'center', fontSize: 'xs', fontWeight: '600', color: 'fg.muted' })}>
            {w}
          </div>
        ))}
        {Array.from({ length: weekday(first) }, (_, i) => (
          <div key={`pad${i}`} />
        ))}
        {dates.map((d) => {
          const day = days[d]
          const inPeriod = openDate <= d && d <= closeDate
          return (
            <Link key={d} to={`/admin/calendar/${d}`} className={cx(cellStyle, !inPeriod && css({ bg: 'surface.muted', color: 'fg.subtle' }))}>
              <div className={css({ fontSize: 'sm', fontWeight: '600' })}>{+d.slice(8)}</div>
              {day && (
                <div className={css({ color: 'fg.muted' })}>
                  {day.slots}コマ
                  <br />
                  {day.booked}/{day.capacity}名
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
