import { settingsInputSchema } from '@ikutoku/shared'
import { Form, useNavigation } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Button, ButtonLink } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { TextareaField, TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { api, unwrap } from '~/lib/api'
import { int, submit, text } from '~/lib/form'
import type { Route } from './+types/settings'

export async function clientLoader() {
  return unwrap(api.admin.settings.$get())
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  const values = {
    openDate: text(form, 'openDate'),
    closeDate: text(form, 'closeDate'),
    maxPeople: int(form, 'maxPeople'),
    resetSeconds: int(form, 'resetSeconds'),
    notice: text(form, 'notice'),
  }
  return (await submit(settingsInputSchema, values, (json) => unwrap(api.admin.settings.$put({ json })))).errors ?? { saved: true }
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

/** A-05・A-09: 受付期間・最大人数・自動リセット・お知らせ */
export default function SettingsPage({ loaderData: s, actionData }: Route.ComponentProps) {
  const submitting = useNavigation().state === 'submitting'
  const errors = actionData && 'error' in actionData ? actionData : undefined
  const fe = errors?.fieldErrors ?? {}
  return (
    <>
      <PageHeader title="全体設定" description="受付期間を変えると、ひな形からその期間のコマを作ります。" />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg', maxW: '640px' })}>
        {actionData && 'saved' in actionData && <Alert tone="success">保存しました。</Alert>}
        {errors?.error && <Alert>{errors.error}</Alert>}
        <Card>
          <Form method="post" className={css({ display: 'flex', flexDirection: 'column', gap: 'md' })}>
            <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'sm' })}>
              <TextField label="受付開始日" name="openDate" type="date" defaultValue={s.openDate} required error={fe.openDate} />
              <TextField label="受付終了日" name="closeDate" type="date" defaultValue={s.closeDate} required error={fe.closeDate} />
            </div>
            <TextField label="1予約あたりの最大人数（名）" name="maxPeople" type="number" min={1} max={50} defaultValue={s.maxPeople} required error={fe.maxPeople} />
            <TextField label="受付端末の自動リセット（秒）" name="resetSeconds" type="number" min={10} max={600} defaultValue={s.resetSeconds} required error={fe.resetSeconds} />
            <TextareaField label="お知らせ（公開ページ・受付端末に表示）" name="notice" rows={4} maxLength={1000} defaultValue={s.notice} error={fe.notice} />
            <Button type="submit" variant="primary" loading={submitting} className={css({ alignSelf: 'flex-start' })}>
              保存
            </Button>
          </Form>
        </Card>
        <Card title="ログイン用の認証アプリ">
          <ButtonLink to="/admin/otp">認証アプリの追加・再発行</ButtonLink>
        </Card>
      </div>
    </>
  )
}
