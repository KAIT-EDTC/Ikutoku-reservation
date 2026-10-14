import { templateInputSchema, WEEKDAYS } from '@ikutoku/shared'
import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { SelectField, TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { confirmSubmit } from '~/features/admin/confirm'
import { api, unwrap } from '~/lib/api'
import { catchApiError, int, optionalText, submit, text } from '~/lib/form'
import { formatTimes } from '~/lib/format'
import type { Route } from './+types/templates'

export async function clientLoader() {
  return unwrap(api.admin.templates.$get())
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  if (text(form, 'intent') === 'delete') {
    return (await catchApiError(() => unwrap(api.admin.templates[':id'].$delete({ param: { id: text(form, 'id') } })))).errors ?? { ok: true }
  }
  const values = {
    weekday: int(form, 'weekday'),
    startTime: text(form, 'startTime'),
    endTime: text(form, 'endTime'),
    capacity: int(form, 'capacity'),
    validFrom: optionalText(form, 'validFrom'),
    validTo: optionalText(form, 'validTo'),
  }
  return (await submit(templateInputSchema, values, (json) => unwrap(api.admin.templates.$post({ json })))).errors ?? { ok: true }
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

const cell = css({ px: 'sm', py: 'xs', textAlign: 'left', fontSize: 'sm', borderBottomWidth: '1px' })

/** A-02: 曜日ごとのコマのひな形 */
export default function TemplatesPage({ loaderData, actionData }: Route.ComponentProps) {
  const errors = actionData && 'error' in actionData ? actionData : undefined
  return (
    <>
      <PageHeader title="コマのひな形" description="受付期間内の該当曜日にコマを自動で作ります。ひな形を削除すると、予約のないコマも削除されます（予約のあるコマは残ります）。" />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
        {errors?.error && !errors.fieldErrors && <Alert>{errors.error}</Alert>}
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ color: 'fg.muted' })}>
              <th className={cell}>曜日</th>
              <th className={cell}>時間</th>
              <th className={cell}>定員</th>
              <th className={cell}>適用期間</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {loaderData.templates.map((t) => (
              <tr key={t.id}>
                <td className={cell}>{WEEKDAYS[t.weekday]}曜</td>
                <td className={cell}>{formatTimes(t)}</td>
                <td className={cell}>{t.capacity}名</td>
                <td className={cell}>
                  {t.validFrom ?? ''} 〜 {t.validTo ?? ''}
                </td>
                <td className={cell}>
                  <Form method="post" onSubmit={confirmSubmit('このひな形を削除しますか？')}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="danger" size="sm">
                      削除
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Card title="ひな形を追加">
          <Form method="post" className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'sm' })}>
            <SelectField label="曜日" name="weekday" error={errors?.fieldErrors?.weekday}>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}曜
                </option>
              ))}
            </SelectField>
            <TextField label="開始" name="startTime" type="time" required error={errors?.fieldErrors?.startTime} />
            <TextField label="終了" name="endTime" type="time" required error={errors?.fieldErrors?.endTime} />
            <TextField label="定員" name="capacity" type="number" min={0} max={999} defaultValue={8} required error={errors?.fieldErrors?.capacity} className={css({ w: '100px' })} />
            <TextField label="適用開始" name="validFrom" type="date" error={errors?.fieldErrors?.validFrom} />
            <TextField label="適用終了" name="validTo" type="date" error={errors?.fieldErrors?.validTo} />
            <Button type="submit" variant="primary" className={css({ mt: '26px' })}>
              追加
            </Button>
          </Form>
        </Card>
      </div>
    </>
  )
}
