import { Form } from 'react-router'
import { css } from 'styled-system/css'
import { Badge } from '~/components/ui/Badge'
import { Button } from '~/components/ui/Button'
import { confirmSubmit } from './confirm'

export type ReservationRow = {
  id: number
  code: string
  people: number
  status: 'active' | 'cancelled'
  createdAt: string
  createdByType: 'device' | 'admin'
  deviceName: string | null
  cancelledAt: string | null
}

const cell = css({ px: 'sm', py: 'xs', textAlign: 'left', fontSize: 'sm', borderBottomWidth: '1px' })

/** 予約番号・人数・予約時刻・作成元と取消ボタン（A-06・A-07） */
export function ReservationTable({ rows }: { rows: ReservationRow[] }) {
  if (!rows.length) return <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>予約なし</p>
  return (
    <div className={css({ overflowX: 'auto' })}>
      <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
        <thead>
          <tr className={css({ color: 'fg.muted' })}>
            <th className={cell}>予約番号</th>
            <th className={cell}>人数</th>
            <th className={cell}>予約時刻</th>
            <th className={cell}>作成元</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={css({ opacity: r.status === 'cancelled' ? 0.5 : 1 })}>
              <td className={cell}>
                <strong className={css({ fontFamily: 'mono', fontSize: 'md' })}>{r.code}</strong>
              </td>
              <td className={cell}>{r.people}名</td>
              <td className={cell}>{r.createdAt}</td>
              <td className={cell}>{r.createdByType === 'device' ? `端末: ${r.deviceName ?? '?'}` : '管理者'}</td>
              <td className={cell}>
                {r.status === 'active' ? (
                  <Form method="post" onSubmit={confirmSubmit(`予約 ${r.code} を取り消しますか？`)}>
                    <input type="hidden" name="intent" value="cancel" />
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" variant="danger" size="sm">
                      取消
                    </Button>
                  </Form>
                ) : (
                  <Badge>取消済 {r.cancelledAt}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
