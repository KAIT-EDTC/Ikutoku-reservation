import type { InferResponseType } from 'hono/client'
import { fmtDate, nowJst, WEEKDAYS } from '../../server/domain.ts'
import { act, api, call, onSubmit, useApi } from '../api.ts'

const weekdaySelect = <select name="weekday">{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}曜</option>)}</select>

export function Templates() {
  const { data, reload } = useApi(() => call(api.admin.templates.$get()), [])
  return (
    <>
      <title>コマのひな形</title>
      <h1>コマのひな形</h1>
      <p className="muted">受付期間内の該当曜日にコマを自動作成します。ひな形を削除すると、予約のないコマも削除されます（予約のあるコマは残ります）。</p>
      <table>
        <thead><tr><th>曜日</th><th>時間</th><th>定員</th><th>適用期間</th><th></th></tr></thead>
        <tbody>{data?.map((t) => (
          <tr key={t.id}>
            <td>{WEEKDAYS[t.weekday]}</td><td>{t.startTime}–{t.endTime}</td><td>{t.capacity}名</td><td>{t.validFrom ?? ''} 〜 {t.validTo ?? ''}</td>
            <td><button className="danger" onClick={() => act(() => call(api.admin.templates[':id'].$delete({ param: { id: String(t.id) } })), reload, '削除しますか？')}>削除</button></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="card"><h2 style={{ marginTop: 0 }}>ひな形を追加</h2>
        <form className="row" onSubmit={onSubmit((json) => call(api.admin.templates.$post({ json })), reload)}>
          {weekdaySelect}
          <input type="time" name="startTime" required />–<input type="time" name="endTime" required />
          <label>定員 <input type="number" name="capacity" min={0} max={999} defaultValue={8} required /></label>
          <label>適用 <input type="date" name="validFrom" /></label>〜<input type="date" name="validTo" /><button className="primary">追加</button>
        </form>
      </div>
    </>
  )
}

type Blackouts = InferResponseType<typeof api.admin.blackouts.$get>
const timeRange = (r: Blackouts['rules'][number]) => (r.timeFrom ? `${r.timeFrom}–${r.timeTo}` : '終日')

function describe(r: Blackouts['rules'][number], slots: Blackouts['slots']) {
  if (r.kind === 'once') return `${r.dateFrom} 〜 ${r.dateTo} ${timeRange(r)}`
  if (r.kind === 'weekly') return `毎週${WEEKDAYS[r.weekday!]}曜 ${timeRange(r)}`
  if (r.kind === 'monthly') return `毎月第${r.nth}${WEEKDAYS[r.weekday!]}曜 ${timeRange(r)}`
  const s = slots.find((s) => s.id === r.slotId)
  return s ? `${fmtDate(s.date)} ${s.startTime} のコマ` : '（削除済みのコマ）'
}

export function Blackouts() {
  const { data, reload } = useApi(() => call(api.admin.blackouts.$get()), [])
  if (!data) return null
  const add = onSubmit((json) => call(api.admin.blackouts.$post({ json })), reload)
  const times = <><label>時間帯 <input type="time" name="timeFrom" />–<input type="time" name="timeTo" /></label><span className="muted">（空欄で終日）</span></>
  const memo = <input name="memo" placeholder="内部メモ（個人情報は書かない）" maxLength={100} />
  const today = nowJst().date
  return (
    <>
      <title>受付不可ルール</title>
      <h1>受付不可ルール</h1>
      <p className="muted">ルールに該当するコマは「受付停止」になります。既存の予約は消えません。</p>
      <table>
        <thead><tr><th>内容</th><th>メモ</th><th>影響する予約</th><th></th></tr></thead>
        <tbody>{data.rules.map((r) => (
          <tr key={r.id}>
            <td>{describe(r, data.slots)}</td><td>{r.memo}</td><td>{r.affected ? <span className="warn">予約{r.affected}件あり</span> : '0件'}</td>
            <td><button className="danger" onClick={() => act(() => call(api.admin.blackouts[':id'].$delete({ param: { id: String(r.id) } })), reload, '削除しますか？')}>削除</button></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="card"><h2 style={{ marginTop: 0 }}>単発の期間</h2>
        <form className="row" onSubmit={add}><input type="hidden" name="kind" value="once" />
          <input type="date" name="dateFrom" required />〜<input type="date" name="dateTo" required />{times}{memo}<button className="primary">追加</button></form></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>毎週の繰り返し</h2>
        <form className="row" onSubmit={add}><input type="hidden" name="kind" value="weekly" />毎週{weekdaySelect}{times}{memo}<button className="primary">追加</button></form></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>毎月の繰り返し</h2>
        <form className="row" onSubmit={add}><input type="hidden" name="kind" value="monthly" />
          毎月第<select name="nth">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>{weekdaySelect}{times}{memo}<button className="primary">追加</button></form></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>特定コマのみ</h2>
        <form className="row" onSubmit={add}><input type="hidden" name="kind" value="slot" />
          <select name="slotId" required>{data.slots.filter((s) => s.date >= today).map((s) => <option key={s.id} value={s.id}>{fmtDate(s.date)} {s.startTime}–{s.endTime}</option>)}</select>
          {memo}<button className="primary">追加</button></form></div>
    </>
  )
}
