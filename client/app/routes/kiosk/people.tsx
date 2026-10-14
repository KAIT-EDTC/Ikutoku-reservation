import { reserveSchema } from '@ikutoku/shared'
import { useEffect, useState } from 'react'
import { Form, redirect, useNavigate, useNavigation, type ShouldRevalidateFunctionArgs } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Button, ButtonLink } from '~/components/ui/Button'
import { ChoiceGrid } from '~/features/kiosk/ChoiceGrid'
import { useIdleReset } from '~/features/kiosk/use-idle-reset'
import { api, unwrap } from '~/lib/api'
import { int, submit } from '~/lib/form'
import { formatDate, formatTimes } from '~/lib/format'
import type { Route } from './+types/people'

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) throw redirect('/kiosk')
  const data = await unwrap(api.kiosk.$get({ query: { date: params.date } }))
  const slot = data.slots.find((s) => s.id === Number(params.slotId))
  if (!slot?.bookable) throw redirect(`/kiosk/${params.date}`)
  const max = Math.min(data.maxPeople, slot.remaining)
  // 人数は URL（?n=）で持つ。確認画面の「戻る」はブラウザの戻ると同じ動きになる
  const n = Number(new URL(request.url).searchParams.get('n'))
  return { date: params.date, slot, max, people: Number.isInteger(n) && n >= 1 && n <= max ? n : null, resetSeconds: data.resetSeconds }
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  const result = await submit(reserveSchema, { slotId: int(form, 'slotId'), people: int(form, 'people') }, (json) =>
    unwrap(api.kiosk.reservations.$post({ json })),
  )
  return result.errors ? { error: result.errors.error } : { done: result.data }
}

/** 予約が済んだら、同じ画面のまま完了表示にする（読み直しで満員になって別画面へ飛ばされないように） */
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return actionResult?.done ? false : defaultShouldRevalidate
}

export default function KioskPeoplePage({ loaderData, actionData }: Route.ComponentProps) {
  const { date, slot, max, people, resetSeconds } = loaderData
  const submitting = useNavigation().state === 'submitting'
  useIdleReset(resetSeconds)
  const when = `${formatDate(date)} ${formatTimes(slot)}`

  if (actionData?.done) return <Done reservation={actionData.done} seconds={resetSeconds} />
  if (actionData?.error) {
    return (
      <>
        <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>予約できませんでした</h1>
        <div className={css({ my: 'lg' })}>
          <Alert>{actionData.error}お手数ですが選び直してください。</Alert>
        </div>
        <ButtonLink to={`/kiosk/${date}`} variant="primary" size="xl" block>
          時間を選び直す
        </ButtonLink>
      </>
    )
  }
  if (!people) {
    return (
      <>
        <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>人数を選んでください</h1>
        <p className={css({ mt: 'sm', color: 'fg.muted' })}>
          {when}（残り{slot.remaining}名）
        </p>
        <ChoiceGrid choices={Array.from({ length: max }, (_, i) => ({ key: i + 1, label: `${i + 1}名`, to: `?n=${i + 1}` }))} />
        <ButtonLink to={`/kiosk/${date}`} size="xl" block>
          ← 時間を選び直す
        </ButtonLink>
      </>
    )
  }
  // F-07: 「戻る」を常に出し、確定ボタンは押したら無効にする
  return (
    <>
      <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>この内容で予約しますか？</h1>
      <dl className={css({ my: 'lg', p: 'lg', display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 'sm', columnGap: 'lg', fontSize: '2xl', bg: 'surface.subtle', borderWidth: '1px', borderRadius: 'lg' })}>
        <dt className={css({ color: 'fg.muted' })}>日時</dt>
        <dd>{when}</dd>
        <dt className={css({ color: 'fg.muted' })}>人数</dt>
        <dd>{people}名</dd>
      </dl>
      <Form method="post" className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'md' })}>
        <input type="hidden" name="slotId" value={slot.id} />
        <input type="hidden" name="people" value={people} />
        <ButtonLink to="?" size="xl">
          ← 戻る
        </ButtonLink>
        <Button type="submit" variant="primary" size="xl" loading={submitting}>
          予約を確定する
        </Button>
      </Form>
    </>
  )
}

/** F-03: 予約番号・日時・人数を大きく出し、カウントダウンのあとトップへ戻る */
function Done({ reservation: r, seconds }: { reservation: { code: string; people: number; date: string; startTime: string; endTime: string }; seconds: number }) {
  const [left, setLeft] = useState(seconds)
  const navigate = useNavigate()
  useEffect(() => {
    if (left <= 0) return void navigate('/kiosk', { replace: true })
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left, navigate])
  return (
    <>
      <h1 className={css({ fontSize: '3xl', fontWeight: '700' })}>予約が完了しました</h1>
      <p className={css({ mt: 'sm', color: 'fg.muted' })}>
        予約番号を<strong>画面ごと撮影</strong>するか、スタッフにお知らせください。
      </p>
      <div className={css({ my: 'lg', p: 'xl', textAlign: 'center', bg: 'surface.subtle', borderWidth: '1px', borderRadius: 'xl' })}>
        <div className={css({ fontSize: 'md', color: 'fg.muted' })}>予約番号</div>
        <div className={css({ fontFamily: 'mono', fontSize: '6xl', fontWeight: '800', letterSpacing: '0.15em' })}>{r.code}</div>
        <div className={css({ fontSize: '2xl' })}>
          {formatDate(r.date)} {formatTimes(r)} ／ {r.people}名
        </div>
      </div>
      <ButtonLink to="/kiosk" replace variant="primary" size="xl" block>
        トップへ戻る（{left}秒）
      </ButtonLink>
    </>
  )
}
