import { blackoutInputSchema, nowJst, WEEKDAYS, type BlackoutKind } from '@ikutoku/shared'
import type { ReactNode } from 'react'
import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Badge } from '~/components/ui/Badge'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { SelectField, TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { confirmSubmit } from '~/features/admin/confirm'
import { api, unwrap } from '~/lib/api'
import { catchApiError, int, optionalText, submit, text } from '~/lib/form'
import { formatDate, formatTimes } from '~/lib/format'
import type { Route } from './+types/blackouts'

export async function clientLoader() {
  return unwrap(api.admin.blackouts.$get())
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  if (text(form, 'intent') === 'delete') {
    return (await catchApiError(() => unwrap(api.admin.blackouts[':id'].$delete({ param: { id: text(form, 'id') } })))).errors ?? { ok: true }
  }
  const kind = text(form, 'kind') as BlackoutKind
  const times = { timeFrom: optionalText(form, 'timeFrom'), timeTo: optionalText(form, 'timeTo') }
  const memo = text(form, 'memo')
  const values =
    kind === 'once' ? { kind, dateFrom: text(form, 'dateFrom'), dateTo: text(form, 'dateTo'), ...times, memo }
    : kind === 'weekly' ? { kind, weekday: int(form, 'weekday'), ...times, memo }
    : kind === 'monthly' ? { kind, weekday: int(form, 'weekday'), nth: int(form, 'nth'), ...times, memo }
    : { kind, slotId: int(form, 'slotId'), memo }
  return (await submit(blackoutInputSchema, values, (json) => unwrap(api.admin.blackouts.$post({ json })))).errors ?? { ok: true }
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

type Data = Route.ComponentProps['loaderData']
const cell = css({ px: 'sm', py: 'xs', textAlign: 'left', fontSize: 'sm', borderBottomWidth: '1px' })
const formRow = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'sm' })

function describe(r: Data['rules'][number], slots: Data['slots']) {
  const range = r.timeFrom ? `${r.timeFrom}–${r.timeTo}` : '終日'
  if (r.kind === 'once') return `${r.dateFrom} 〜 ${r.dateTo} ${range}`
  if (r.kind === 'weekly') return `毎週${WEEKDAYS[r.weekday!]}曜 ${range}`
  if (r.kind === 'monthly') return `毎月第${r.nth}${WEEKDAYS[r.weekday!]}曜 ${range}`
  const s = slots.find((s) => s.id === r.slotId)
  return s ? `${formatDate(s.date)} ${s.startTime} のコマ` : '（削除済みのコマ）'
}

function RuleForm({ kind, title, children, times = true }: { kind: BlackoutKind; title: string; children?: ReactNode; times?: boolean }) {
  return (
    <Card title={title}>
      <Form method="post" className={formRow}>
        <input type="hidden" name="kind" value={kind} />
        {children}
        {times && (
          <>
            <TextField label="時間帯（空欄で終日）" name="timeFrom" type="time" />
            <TextField label="〜" name="timeTo" type="time" />
          </>
        )}
        <TextField label="内部メモ（個人情報は書かない）" name="memo" maxLength={100} />
        <Button type="submit" variant="primary">
          追加
        </Button>
      </Form>
    </Card>
  )
}

const weekdaySelect = (
  <SelectField label="曜日" name="weekday">
    {WEEKDAYS.map((w, i) => (
      <option key={i} value={i}>
        {w}曜
      </option>
    ))}
  </SelectField>
)

/** A-04・仕様6章: 受付不可ルール4種類。既存の予約は消さず、影響する予約数を出す */
export default function BlackoutsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { rules, slots } = loaderData
  const errors = actionData && 'error' in actionData ? actionData : undefined
  const today = nowJst().date
  return (
    <>
      <PageHeader title="受付不可ルール" description="ルールに当てはまるコマは「受付停止」になります（公開ページにも受付停止と出ます）。既存の予約は消えません。" />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
        {errors?.error && <Alert>{Object.values(errors.fieldErrors ?? {})[0] ?? errors.error}</Alert>}
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ color: 'fg.muted' })}>
              <th className={cell}>内容</th>
              <th className={cell}>メモ</th>
              <th className={cell}>影響する予約</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{describe(r, slots)}</td>
                <td className={cell}>{r.memo}</td>
                <td className={cell}>{r.affected ? <Badge tone="warning">予約{r.affected}件あり</Badge> : '0件'}</td>
                <td className={cell}>
                  <Form method="post" onSubmit={confirmSubmit('このルールを削除しますか？')}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" variant="danger" size="sm">
                      削除
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <RuleForm kind="once" title="単発の期間">
          <TextField label="開始日" name="dateFrom" type="date" required />
          <TextField label="終了日" name="dateTo" type="date" required />
        </RuleForm>
        <RuleForm kind="weekly" title="毎週の繰り返し">
          {weekdaySelect}
        </RuleForm>
        <RuleForm kind="monthly" title="毎月の繰り返し">
          <SelectField label="第n週" name="nth">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                第{n}
              </option>
            ))}
          </SelectField>
          {weekdaySelect}
        </RuleForm>
        <RuleForm kind="slot" title="特定コマのみ" times={false}>
          <SelectField label="コマ" name="slotId" required>
            {slots
              .filter((s) => s.date >= today)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.date)} {formatTimes(s)}
                </option>
              ))}
          </SelectField>
        </RuleForm>
      </div>
    </>
  )
}
