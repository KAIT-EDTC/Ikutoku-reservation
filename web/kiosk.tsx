import type { InferResponseType } from 'hono/client'
import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { fmtDate } from '../server/domain.ts'
import { api, call, isDate, MARK, useApi } from './api.ts'

type Done = InferResponseType<typeof api.kiosk.reserve.$post> & { resetSeconds: number }

export function KioskLayout() {
  return <div className="kiosk"><meta name="robots" content="noindex" /><main><Outlet /></main></div>
}

// 401 (unregistered device) is sent to the public page by call().
const useKiosk = (date?: string) => useApi(() => call(api.kiosk.$get({ query: isDate(date) ? { date } : {} })), [date])

// F-05: after `seconds` without a touch, any kiosk page other than the top returns there.
function useIdleReset(seconds?: number) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!seconds) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(() => navigate('/kiosk', { replace: true }), seconds * 1000)
    }
    addEventListener('pointerdown', reset)
    addEventListener('keydown', reset)
    reset()
    return () => {
      clearTimeout(t)
      removeEventListener('pointerdown', reset)
      removeEventListener('keydown', reset)
    }
  }, [seconds, navigate])
}

export function KioskDates() {
  const { data, error } = useKiosk()
  if (!data) return <p className="warn">{error}</p>
  return (
    <>
      <title>予約受付</title>
      {data.notice && <div className="notice">{data.notice}</div>}
      <h1>ご予約の日付を選んでください</h1>
      <div className="big">{data.dates.map((d) => <Link key={d} to={`/kiosk/${d}`}>{fmtDate(d)}</Link>)}</div>
      {!data.dates.length && <p>現在受付中の日付はありません。</p>}
    </>
  )
}

export function KioskSlots() {
  const { date } = useParams()
  const { data, error } = useKiosk(date)
  useIdleReset(data?.resetSeconds)
  if (error || !isDate(date)) return <Navigate to="/kiosk" replace />
  if (!data) return null
  return (
    <>
      <title>時間を選択</title>
      <h1>{fmtDate(date)} の時間を選んでください</h1>
      <div className="big">{data.slots.map((sl) => {
        const label = <>{sl.startTime}–{sl.endTime}<small>{sl.bookable ? `残り${sl.remaining}名` : sl.status === 'full' ? '満員' : MARK[sl.status]}</small></>
        return sl.bookable ? <Link key={sl.id} to={`/kiosk/${date}/${sl.id}`}>{label}</Link> : <span key={sl.id} aria-disabled="true">{label}</span>
      })}</div>
      <div className="actions"><Link className="btn" to="/kiosk">← 日付を選び直す</Link></div>
    </>
  )
}

// People → confirm (F-07: back is always visible, confirm disables itself) → done.
export function KioskPeople() {
  const { date, slot } = useParams()
  const { data, error } = useKiosk(date)
  const [people, setPeople] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const navigate = useNavigate()
  useIdleReset(data?.resetSeconds)
  if (error || !isDate(date)) return <Navigate to="/kiosk" replace />
  if (!data) return null
  const sl = data.slots.find((s) => s.id === Number(slot))
  if (failed) {
    return (
      <>
        <h1>予約できませんでした</h1><p>{failed}お手数ですが選び直してください。</p>
        <div className="actions"><Link className="btn primary" to={`/kiosk/${date}`}>時間を選び直す</Link></div>
      </>
    )
  }
  if (!sl?.bookable) return <Navigate to={`/kiosk/${date}`} replace />
  const when = `${fmtDate(date)} ${sl.startTime}–${sl.endTime}`

  const book = async () => {
    setBusy(true)
    try {
      const r = await call(api.kiosk.reserve.$post({ json: { slotId: sl.id, people } }))
      navigate('/kiosk/done', { replace: true, state: { ...r, resetSeconds: data!.resetSeconds } satisfies Done })
    } catch (e) {
      setFailed((e as Error).message)
    }
  }

  if (!people) {
    return (
      <>
        <title>人数を選択</title>
        <h1>人数を選んでください</h1><p>{when}（残り{sl.remaining}名）</p>
        <div className="big">{Array.from({ length: Math.min(data.maxPeople, sl.remaining) }, (_, i) => (
          <button key={i} onClick={() => setPeople(i + 1)}>{i + 1}名</button>
        ))}</div>
        <div className="actions"><Link className="btn" to={`/kiosk/${date}`}>← 時間を選び直す</Link></div>
      </>
    )
  }
  return (
    <>
      <title>内容の確認</title>
      <h1>この内容で予約しますか？</h1>
      <div className="card" style={{ fontSize: '1.3em' }}><p>日時：{when}</p><p>人数：{people}名</p></div>
      <div className="actions">
        <button onClick={() => setPeople(0)}>← 戻る</button>
        <button className="primary" disabled={busy} onClick={book}>予約を確定する</button>
      </div>
    </>
  )
}

// F-03: big reservation code, then back to the top after a countdown.
export function KioskDone() {
  const r = useLocation().state as Done | null
  const [left, setLeft] = useState(r?.resetSeconds ?? 0)
  const navigate = useNavigate()
  useEffect(() => {
    if (left <= 0) return void navigate('/kiosk', { replace: true })
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [left, navigate])
  if (!r) return null
  return (
    <>
      <title>予約完了</title>
      <h1>予約が完了しました</h1>
      <p>予約番号を<strong>画面ごと撮影</strong>するか、スタッフにお知らせください。</p>
      <div className="card">
        <div className="muted">予約番号</div><div className="code">{r.code}</div>
        <p style={{ textAlign: 'center', fontSize: '1.4em' }}>{fmtDate(r.date)} {r.startTime}–{r.endTime} ／ {r.people}名</p>
      </div>
      <div className="actions"><Link className="btn primary" to="/kiosk" replace>トップへ戻る（{left}秒）</Link></div>
    </>
  )
}
