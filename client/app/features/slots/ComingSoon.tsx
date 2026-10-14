import { EmptyState } from '~/components/ui/EmptyState'
import { PageHeader } from '~/components/ui/PageHeader'

/** 全体設定で「公開する」がオフの間の公開ページ */
export function ComingSoon() {
  return (
    <>
      <PageHeader title="準備中" />
      <EmptyState title="予約の受付はまだ始まっていません">公開までしばらくお待ちください。</EmptyState>
    </>
  )
}
