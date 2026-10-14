import { css } from 'styled-system/css'
import { PageHeader } from '~/components/ui/PageHeader'
import type { Route } from './+types/guide'

export const meta: Route.MetaFunction = () => [{ title: '利用案内 | EDTC' }]

export default function GuidePage() {
  return (
    <>
      <PageHeader title="利用案内" />
      <ol className={css({ listStyle: 'decimal', pl: 'lg', display: 'flex', flexDirection: 'column', gap: 'sm', lineHeight: '1.8' })}>
        <li>予約は<strong>会場の受付端末</strong>でのみ受け付けています。このページでは空き状況だけを確認できます。</li>
        <li>受付端末で「日付 → 時間 → 人数 → 確認」の順に選ぶと予約番号が表示されます。</li>
        <li>予約番号は<strong>画面を撮影</strong>して控えてください。スマホがない方にはスタッフが紙に書いてお渡しします。</li>
        <li>お名前や連絡先はお伺いしません。予約の取消・変更は予約番号をスタッフにお伝えください。</li>
        <li>中止や変更は「お知らせ」でお知らせします。ご来場前にご確認ください。</li>
      </ol>
    </>
  )
}
