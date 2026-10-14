import { otpResetSchema } from '@ikutoku/shared'
import { Form, redirect, useNavigation } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Button, ButtonLink } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { api, unwrap } from '~/lib/api'
import { submit, text } from '~/lib/form'
import type { Route } from './+types/otp'

/** ?new=1 なら新しい秘密鍵、それ以外は今の秘密鍵のQR */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const fresh = new URL(request.url).searchParams.has('new')
  return { fresh, qr: await unwrap(fresh ? api.admin.settings.otp.new.$get() : api.admin.settings.otp.$get()) }
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  const result = await submit(otpResetSchema, { secret: text(form, 'secret'), code: text(form, 'code') }, (json) => unwrap(api.admin.settings.otp.$post({ json })))
  return result.errors ?? redirect('/admin/login')
}

/** 再発行の確認中に読み直すと秘密鍵が変わってしまうので、送信後は読み直さない */
export const shouldRevalidate = () => false

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

function Qr({ secret, svg }: { secret: string; svg: string }) {
  return (
    <>
      <div className={css({ maxW: '260px' })} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className={css({ mt: 'sm', fontSize: 'sm', color: 'fg.muted' })}>
        手入力用キー: <code>{secret}</code>
      </p>
    </>
  )
}

export default function OtpPage({ loaderData, actionData }: Route.ComponentProps) {
  const { fresh, qr } = loaderData
  const submitting = useNavigation().state === 'submitting'
  if (fresh) {
    return (
      <>
        <PageHeader title="認証アプリの再発行" back={{ to: '/admin/otp', label: 'やめる' }} />
        <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg', maxW: '640px' })}>
          <Alert tone="warning">新しいQRを認証アプリで読み取り、表示された6桁を入力して確定してください。確定すると古いコードは使えなくなり、全員ログアウトされます。</Alert>
          {actionData?.error && <Alert>{actionData.fieldErrors?.code ?? actionData.error}</Alert>}
          <Card>
            <Qr {...qr} />
            <Form method="post" className={css({ mt: 'md', display: 'flex', alignItems: 'flex-end', gap: 'sm' })}>
              <input type="hidden" name="secret" value={qr.secret} />
              <TextField label="6桁コード" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
              <Button type="submit" variant="primary" loading={submitting}>
                確定
              </Button>
            </Form>
          </Card>
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader title="ログイン用の認証アプリ" back={{ to: '/admin/settings', label: '全体設定' }} />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg', maxW: '640px' })}>
        <Alert tone="warning">
          メンバーのスマホに認証アプリ（Google Authenticator など）を入れ、このQRを読み取るとログインできます。このQRは管理者ログインそのものなので、メンバー以外に見せないでください。
        </Alert>
        <Card>
          <Qr {...qr} />
        </Card>
        <Card title="再発行">
          <p className={css({ mb: 'md', fontSize: 'sm', color: 'fg.muted' })}>スマホの紛失やメンバーの交代時に使います。全員が読み取り直す必要があります。</p>
          <ButtonLink to="?new=1">再発行する</ButtonLink>
        </Card>
      </div>
    </>
  )
}
