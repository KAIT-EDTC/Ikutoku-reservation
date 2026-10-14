import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Alert } from '~/components/ui/Alert'
import { Badge } from '~/components/ui/Badge'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { Checkbox, TextField } from '~/components/ui/Field'
import { SlotStatusBadge } from '~/features/slots/SlotStatusBadge'
import type { FormErrors } from '~/lib/form'
import { formatTimes } from '~/lib/format'
import { confirmSubmit } from './confirm'
import type { loadDay } from './day-action'
import { ReservationTable } from './ReservationTable'

type Day = Awaited<ReturnType<typeof loadDay>>
export type DayActionData = (FormErrors & { issued?: undefined }) | { issued: { code: string; people: number } } | { ok: true } | undefined

const row = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'sm' })
const summary = css({ cursor: 'pointer', fontSize: 'sm', fontWeight: '600', color: 'fg.muted', py: 'xs' })

/** コマごとの予約一覧と、代理予約・編集・停止・削除・追加（A-03・A-06・A-07） */
export function DayView({ date, day, actionData }: { date: string; day: Day; actionData: DayActionData }) {
  const sum = (f: (s: Day['slots'][number]) => number) => day.slots.reduce((n, s) => n + f(s), 0)
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: 'lg' })}>
      {actionData && 'error' in actionData && actionData.error && <Alert>{Object.values(actionData.fieldErrors ?? {})[0] ?? actionData.error}</Alert>}
      {actionData && 'issued' in actionData && actionData.issued && (
        <Alert tone="success">
          代理予約を登録しました。予約番号 <strong className={css({ fontFamily: 'mono', fontSize: 'lg' })}>{actionData.issued.code}</strong>（{actionData.issued.people}名）
        </Alert>
      )}
      <p className={css({ fontSize: 'sm', color: 'fg.muted' })}>
        予約合計 <strong className={css({ color: 'fg' })}>{sum((s) => s.booked)}名</strong> ／ 定員合計 {sum((s) => s.capacity)}名
      </p>
      {day.slots.map((sl) => (
        <Card
          key={sl.id}
          title={
            <span className={css({ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 'sm' })}>
              {formatTimes(sl)}
              <SlotStatusBadge status={sl.status} />
              <span className={css({ fontSize: 'sm', fontWeight: '500', color: 'fg.muted' })}>
                予約 {sl.booked}/{sl.capacity}名（残 {sl.capacity - sl.booked}）
              </span>
              {sl.status === 'stopped' && sl.count > 0 && <Badge tone="warning">受付停止中ですが予約{sl.count}件あり</Badge>}
              {sl.booked > sl.capacity && <Badge tone="danger">定員超過</Badge>}
            </span>
          }
        >
          <div className={css({ display: 'flex', flexDirection: 'column', gap: 'md' })}>
            <ReservationTable rows={sl.reservations} />
            <details>
              <summary className={summary}>代理予約</summary>
              <Form method="post" className={row}>
                <input type="hidden" name="intent" value="reserve" />
                <input type="hidden" name="slotId" value={sl.id} />
                <TextField label="人数" name="people" type="number" min={1} max={99} defaultValue={1} required className={css({ w: '100px' })} />
                <Checkbox label="定員超過を許可" name="overbook" />
                <Button type="submit" variant="primary">
                  登録
                </Button>
              </Form>
            </details>
            <details>
              <summary className={summary}>このコマを編集</summary>
              <div className={css({ display: 'flex', flexDirection: 'column', gap: 'md', pt: 'sm' })}>
                <Form method="post" className={row}>
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={sl.id} />
                  <TextField label="開始" name="startTime" type="time" defaultValue={sl.startTime} required />
                  <TextField label="終了" name="endTime" type="time" defaultValue={sl.endTime} required />
                  <TextField label="定員" name="capacity" type="number" min={0} max={999} defaultValue={sl.capacity} required className={css({ w: '100px' })} />
                  <Button type="submit">保存</Button>
                </Form>
                <div className={row}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="stop" />
                    <input type="hidden" name="id" value={sl.id} />
                    <input type="hidden" name="stopped" value={String(!sl.stopped)} />
                    <Button type="submit">{sl.stopped ? 'このコマの受付を再開' : 'このコマだけ受付停止'}</Button>
                  </Form>
                  <Form method="post" onSubmit={confirmSubmit('このコマを削除しますか？')}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={sl.id} />
                    <Button type="submit" variant="danger">
                      コマを削除
                    </Button>
                  </Form>
                </div>
              </div>
            </details>
          </div>
        </Card>
      ))}
      {!day.slots.length && <p className={css({ color: 'fg.muted' })}>この日のコマはありません。</p>}
      <Card title="コマを追加">
        <Form method="post" className={row}>
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="date" value={date} />
          <TextField label="開始" name="startTime" type="time" required />
          <TextField label="終了" name="endTime" type="time" required />
          <TextField label="定員" name="capacity" type="number" min={0} max={999} defaultValue={8} required className={css({ w: '100px' })} />
          <Button type="submit">追加</Button>
        </Form>
      </Card>
    </div>
  )
}
