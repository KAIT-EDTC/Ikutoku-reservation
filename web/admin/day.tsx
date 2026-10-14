import type { InferResponseType } from 'hono/client'
import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { datesBetween, fmtDate, nowJst, WEEKDAYS, weekday } from '../../server/domain.ts'
import { act, api, call, isDate, MARK, markClass, onSubmit, useApi } from '../api.ts'

type Reservation = InferResponseType<typeof api.admin.reservations.$get>['found'] & {}

function ReservationTable({ rows, reload }: { rows: Reservation[]; reload: () => unknown }) {
  if (!rows.length) return <p className="muted">予約なし</p>
  return (
    <table>
      <thead><tr><th>予約番号</th><th>人数</th><th>予約時刻</th><th>作成元</th><th></th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id} className={r.status === 'cancelled' ? 'muted' : ''}>
          <td><strong>{r.code}</strong></td><td>{r.people}名</td><td>{r.createdAt}</td>
          <td>{r.createdByType === 'device' ? `端末:${r.deviceName ?? '?'}` : '管理者'}</td>
          <td>{r.status === 'active'
            ? <button className="danger" onClick={() => act(() => call(api.admin.reservations[':id'].cancel.$post({ param: { id: String(r.id) } })), reload, `予約 ${r.code} を取り消しますか？`)}>取消</button>
            : `取消済 ${r.cancelledAt ?? ''}`}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

// Reservations per slot plus everything an admin does to a day: proxy booking, edit, stop, delete, add.
function DayView({ date }: { date: string }) {
  const { data, reload } = useApi(() => call(api.admin.day[':date'].$get({ param: { date } })), [date])
  const [issued, setIssued] = useState<{ code: string; people: number }>()
  if (!data) return null
  const { slots } = data
  const sum = (f: (s: (typeof slots)[number]) => number) => slots.reduce((a, s) => a + f(s), 0)
  return (
    <>
      {issued && <div className="card"><div className="muted">代理予約の予約番号</div><div className="code">{issued.code}</div><p style={{ textAlign: 'center' }}>{issued.people}名</p></div>}
      <p>予約合計 <strong>{sum((s) => s.booked)}名</strong> ／ 定員合計 {sum((s) => s.capacity)}名</p>
      {data.slots.map((sl) => {
        const id = { param: { id: String(sl.id) } }
        return (
          <div className="card" key={sl.id}>
            <div className="row">
              <h2 style={{ margin: 0 }}>{sl.startTime}–{sl.endTime}</h2>
              <span className={`mark ${markClass(sl.status)}`}>{MARK[sl.status]}</span>
              <span>予約 {sl.booked}/{sl.capacity}名（残 {sl.capacity - sl.booked}）</span>
              {sl.status === 'stopped' && sl.count > 0 && <span className="warn">受付停止中ですが予約{sl.count}件あり</span>}
              {sl.booked > sl.capacity && <span className="warn">定員超過</span>}
            </div>
            <ReservationTable rows={sl.reservations} reload={reload} />
            <details><summary>代理予約</summary>
              <form className="row" onSubmit={onSubmit((json) => call(api.admin.reservations.$post({ json })).then(setIssued), reload)}>
                <input type="hidden" name="slotId" value={sl.id} />
                <label>人数 <input type="number" name="people" min={1} max={99} defaultValue={1} required /></label>
                <label><input type="checkbox" name="overbook" /> 定員超過を許可</label><button className="primary">登録</button>
              </form>
            </details>
            <details><summary>このコマを編集</summary>
              <form className="row" onSubmit={onSubmit((json) => call(api.admin.slots[':id'].$put({ ...id, json })), reload)}>
                <input type="time" name="startTime" defaultValue={sl.startTime} required />–<input type="time" name="endTime" defaultValue={sl.endTime} required />
                <label>定員 <input type="number" name="capacity" min={0} max={999} defaultValue={sl.capacity} required /></label>
                <button>保存</button>
              </form>
              <p className="row">
                <button onClick={() => act(() => call(api.admin.slots[':id'].stop.$post({ ...id, json: { stopped: !sl.stopRule } })), reload)}>
                  {sl.stopRule ? 'このコマの受付を再開' : 'このコマだけ受付停止'}
                </button>
                <button className="danger" onClick={() => act(() => call(api.admin.slots[':id'].$delete(id)), reload, 'このコマを削除しますか？')}>コマを削除</button>
              </p>
            </details>
          </div>
        )
      })}
      {!data.slots.length && <p>この日のコマはありません。</p>}
      <div className="card"><h2 style={{ marginTop: 0 }}>コマを追加</h2>
        <form className="row" onSubmit={onSubmit((json) => call(api.admin.slots.$post({ json })), reload)}>
          <input type="hidden" name="date" value={date} />
          <input type="time" name="startTime" required />–<input type="time" name="endTime" required />
          <label>定員 <input type="number" name="capacity" min={0} max={999} defaultValue={8} required /></label><button>追加</button>
        </form>
      </div>
    </>
  )
}

export function Today() {
  const today = nowJst().date
  const [params, setParams] = useSearchParams()
  const code = params.get('code') ?? ''
  const search = useApi(() => (code ? call(api.admin.reservations.$get({ query: { code } })) : Promise.resolve(null)), [code])
  return (
    <>
      <title>今日の予約</title>
      <form className="row card" onSubmit={(e) => (e.preventDefault(), setParams({ code: String(new FormData(e.currentTarget).get('code')).trim().toUpperCase() }))}>
        <label>予約番号で検索 <input name="code" defaultValue={code} autoCapitalize="characters" size={8} /></label><button>検索</button>
      </form>
      {code && search.data !== undefined && (
        <div className="card">{search.data?.found
          ? <><p>{fmtDate(search.data.found.date)} {search.data.found.startTime}–{search.data.found.endTime}</p><ReservationTable rows={[search.data.found]} reload={search.reload} /></>
          : <p>予約番号 {code} は見つかりません。</p>}</div>
      )}
      <h1>今日（{fmtDate(today)}）の予約</h1>
      <DayView date={today} />
    </>
  )
}

export function Calendar() {
  const [params] = useSearchParams()
  const month = params.get('month') ?? undefined
  const { data } = useApi(() => call(api.admin.calendar.$get({ query: month ? { month } : {} })), [month])
  if (!data) return null
  const first = `${data.month}-01`
  const shift = (n: number) => new Date(Date.UTC(+data.month.slice(0, 4), +data.month.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7)
  const days = datesBetween(first, `${shift(1)}-01`).slice(0, -1)
  return (
    <>
      <title>カレンダー</title>
      <div className="row">
        <Link className="btn" to={`?month=${shift(-1)}`}>←</Link><h1 style={{ margin: 0 }}>{data.month.replace('-', '年')}月</h1><Link className="btn" to={`?month=${shift(1)}`}>→</Link>
        <span className="muted">受付期間 {data.openDate} 〜 {data.closeDate}</span>
      </div>
      <div className="cal" style={{ marginTop: 12 }}>
        {WEEKDAYS.map((w) => <div key={w} style={{ minHeight: 'auto', textAlign: 'center' }}>{w}</div>)}
        {Array.from({ length: weekday(first) }, (_, i) => <div key={`pad${i}`} style={{ visibility: 'hidden' }} />)}
        {days.map((d) => {
          const r = data.days[d]
          return (
            <div key={d} style={data.openDate <= d && d <= data.closeDate ? {} : { background: '#eceef1' }}>
              <Link to={`/admin/calendar/${d}`}>{+d.slice(8)}</Link>
              {r && <><br />{r.n}コマ<br />{r.booked}/{r.capacity}名</>}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function CalendarDay() {
  const { date } = useParams()
  if (!isDate(date)) return <Navigate to="/admin/calendar" replace />
  return (
    <>
      <title>{fmtDate(date)}</title>
      <p><Link to={`/admin/calendar?month=${date.slice(0, 7)}`}>← カレンダー</Link></p>
      <h1>{date}（{WEEKDAYS[weekday(date)]}）</h1>
      <DayView date={date} />
    </>
  )
}
