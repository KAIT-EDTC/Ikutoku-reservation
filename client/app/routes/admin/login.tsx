import { loginSchema } from '@ikutoku/shared'
import { Form, redirect, useNavigation } from 'react-router'
import { css } from 'styled-system/css'
import { PublicShell } from '~/components/layout/PublicShell'
import { Alert } from '~/components/ui/Alert'
import { Button } from '~/components/ui/Button'
import { TextField } from '~/components/ui/Field'
import { api, unwrap } from '~/lib/api'
import { submit, text } from '~/lib/form'
import type { Route } from './+types/login'

export const meta: Route.MetaFunction = () => [{ title: 'ログイン | 予約 管理' }, { name: 'robots', content: 'noindex' }]

export async function clientLoader() {
  // ログイン済みなら管理画面へ
  const res = await api.auth.me.$get().catch(() => null)
  if (res?.ok) throw redirect('/admin')
  // PRプレビュー（workers.dev）だけ、コードなしのログインを出す。本番では API 側も 404 を返す
  return { preview: location.hostname.endsWith('.workers.dev') }
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  if (text(form, 'intent') === 'preview') {
    await unwrap(api.auth['preview-login'].$post())
    return redirect('/admin')
  }
  const result = await submit(loginSchema, { code: text(form, 'code') }, (json) => unwrap(api.auth.login.$post({ json })))
  return result.errors ?? redirect('/admin')
}

/** A-01: 共有の管理者アカウント。認証アプリの6桁コードでログインする */
export default function LoginPage({ loaderData, actionData }: Route.ComponentProps) {
  const submitting = useNavigation().state === 'submitting'
  return (
    <PublicShell>
      <h1 className={css({ fontSize: '2xl', fontWeight: '700', mb: 'lg' })}>管理者ログイン</h1>
      <Form method="post" className={css({ display: 'flex', flexDirection: 'column', gap: 'md' })}>
        {actionData?.error && <Alert>{actionData.fieldErrors?.code ?? actionData.error}</Alert>}
        <TextField
          label="認証アプリの6桁コード"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          autoFocus
          className={css({ '& input': { fontSize: '2xl', letterSpacing: '0.2em' } })}
        />
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          ログイン
        </Button>
      </Form>
      {loaderData.preview && (
        <Form method="post" className={css({ mt: 'lg' })}>
          <input type="hidden" name="intent" value="preview" />
          <Button type="submit" variant="ghost" block>
            コードなしでログイン（プレビュー専用）
          </Button>
        </Form>
      )}
    </PublicShell>
  )
}
