import { Alert } from '~/components/ui/Alert'
import { EmptyState } from '~/components/ui/EmptyState'
import { PageHeader } from '~/components/ui/PageHeader'
import { ComingSoon } from '~/features/slots/ComingSoon'
import { api, unwrap } from '~/lib/api'
import type { Route } from './+types/news'

export const meta: Route.MetaFunction = () => [{ title: 'お知らせ | EDTC' }]

export async function clientLoader() {
  const { published, notice } = await unwrap(api.public.$get({ query: {} }))
  return { published, notice }
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

export default function NewsPage({ loaderData }: Route.ComponentProps) {
  if (!loaderData.published) return <ComingSoon />
  return (
    <>
      <PageHeader title="お知らせ" description="休止・変更のお知らせ" />
      {loaderData.notice ? <Alert tone="info">{loaderData.notice}</Alert> : <EmptyState title="現在お知らせはありません" />}
    </>
  )
}
