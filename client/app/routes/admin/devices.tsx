import { deviceActiveSchema, deviceNameSchema } from '@ikutoku/shared'
import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Badge } from '~/components/ui/Badge'
import { Button, ButtonLink } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { inputStyle, TextField } from '~/components/ui/Field'
import { PageHeader } from '~/components/ui/PageHeader'
import { api, unwrap } from '~/lib/api'
import { submit, text } from '~/lib/form'
import type { Route } from './+types/devices'

export async function clientLoader() {
  return unwrap(api.admin.devices.$get())
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData()
  const param = { param: { id: text(form, 'id') } }
  const name = { name: text(form, 'name') }
  switch (text(form, 'intent')) {
    case 'register':
      return (await submit(deviceNameSchema, name, (json) => unwrap(api.admin.devices.$post({ json })))).errors ?? { ok: true }
    case 'rename':
      return (await submit(deviceNameSchema, name, (json) => unwrap(api.admin.devices[':id'].$put({ ...param, json })))).errors ?? { ok: true }
    case 'active':
      return (
        (await submit(deviceActiveSchema, { active: text(form, 'active') === 'true' }, (json) => unwrap(api.admin.devices[':id'].active.$put({ ...param, json })))).errors ?? {
          ok: true,
        }
      )
  }
  throw new Error('unknown intent')
}

export { RouteErrorBoundary as ErrorBoundary } from '~/components/layout/RouteErrorBoundary'

const cell = css({ px: 'sm', py: 'xs', textAlign: 'left', fontSize: 'sm', borderBottomWidth: '1px' })

/** A-08: 受付端末の登録・名前変更・無効化（紛失時） */
export default function DevicesPage({ loaderData, actionData }: Route.ComponentProps) {
  const { devices, currentId } = loaderData
  const current = devices.find((d) => d.id === currentId)
  const errors = actionData && 'error' in actionData ? actionData : undefined
  return (
    <>
      <PageHeader title="受付端末" description="予約画面（/kiosk）は、ここで登録した端末からしか開けません。" />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
        {errors?.error && <Alert>{errors.fieldErrors?.name ?? errors.error}</Alert>}
        {current ? (
          <Card title="この端末">
            <p className={css({ mb: 'md' })}>
              「<strong>{current.name}</strong>」として{current.active ? '登録済み' : '登録されていますが無効'}です。
            </p>
            <ButtonLink to="/kiosk" variant="primary">
              予約画面を開く
            </ButtonLink>
          </Card>
        ) : (
          <Card title="この端末を受付端末として登録">
            <p className={css({ mb: 'md', fontSize: 'sm', color: 'fg.muted' })}>受付に置くiPad/PCでこの画面を開いて登録し、ログアウトしてから /kiosk を開いてください。</p>
            <Form method="post" className={css({ display: 'flex', alignItems: 'flex-end', gap: 'sm' })}>
              <input type="hidden" name="intent" value="register" />
              <TextField label="端末名" name="name" placeholder="受付iPad 1" required maxLength={40} />
              <Button type="submit" variant="primary">
                登録
              </Button>
            </Form>
          </Card>
        )}
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ color: 'fg.muted' })}>
              <th className={cell}>端末名</th>
              <th className={cell}>登録日時</th>
              <th className={cell}>状態</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td className={cell}>
                  <Form method="post" className={css({ display: 'flex', gap: 'xs' })}>
                    <input type="hidden" name="intent" value="rename" />
                    <input type="hidden" name="id" value={d.id} />
                    <input name="name" defaultValue={d.name} required maxLength={40} aria-label="端末名" className={inputStyle} />
                    <Button type="submit" size="sm">
                      名前変更
                    </Button>
                  </Form>
                </td>
                <td className={cell}>{d.createdAt}</td>
                <td className={cell}>{d.active ? <Badge tone="success">有効</Badge> : <Badge>無効</Badge>}</td>
                <td className={cell}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="active" />
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="active" value={String(!d.active)} />
                    <Button type="submit" size="sm" variant={d.active ? 'danger' : 'secondary'}>
                      {d.active ? '無効化' : '有効化'}
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
