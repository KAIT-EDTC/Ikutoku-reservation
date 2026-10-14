import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { EmptyState } from '~/components/ui/EmptyState'
import { PageHeader } from '~/components/ui/PageHeader'
import { SlotStatusBadge } from '~/features/slots/SlotStatusBadge'
import { api, unwrap } from '~/lib/api'
import { formatDate, formatTimes } from '~/lib/format'
import type { Route } from './+types/home'

export const meta: Route.MetaFunction = () => [{ title: '予約空き状況 | EDTC' }]

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const date = 'date' in params && /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined
  return unwrap(api.public.$get({ query: date ? { date } : {} }))
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

const tabStyle = css({ px: 'md', h: '36px', display: 'inline-flex', alignItems: 'center', fontSize: 'sm', fontWeight: '600', borderRadius: 'full', borderWidth: '1px', bg: 'surface', color: 'fg.muted', _hover: { color: 'fg' } })
const tabActiveStyle = css({ bg: 'accent', borderColor: 'accent', color: 'fg.inverted', _hover: { color: 'fg.inverted' } })

/** F-01: 日付ごとのコマと残り人数。予約ボタンは出さない */
export default function AvailabilityPage({ loaderData }: Route.ComponentProps) {
  const { notice, dates, date, slots } = loaderData
  return (
    <>
      <PageHeader title="空き状況" description="予約は会場の受付で行います。○ 余裕あり / △ 残りわずか / × 満員" />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
        {notice && <Alert tone="info">{notice}</Alert>}
        <nav className={css({ display: 'flex', flexWrap: 'wrap', gap: 'sm' })}>
          {dates.map((d) => (
            <Link key={d} to={`/day/${d}`} className={cx(tabStyle, d === date && tabActiveStyle)}>
              {formatDate(d)}
            </Link>
          ))}
        </nav>
        {slots.length ? (
          <ul className={css({ display: 'flex', flexDirection: 'column', borderWidth: '1px', borderRadius: 'lg', overflow: 'hidden' })}>
            {slots.map((sl) => (
              <li key={sl.id} className={css({ display: 'flex', alignItems: 'center', gap: 'md', px: 'lg', py: 'md', '&:not(:first-child)': { borderTopWidth: '1px' } })}>
                <span className={css({ fontSize: 'lg', fontWeight: '600', flex: 1 })}>{formatTimes(sl)}</span>
                {sl.bookable && <span className={css({ fontSize: 'sm', color: 'fg.muted' })}>残り{sl.remaining}名</span>}
                <SlotStatusBadge status={sl.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="表示できるコマがありません" />
        )}
      </div>
    </>
  )
}
