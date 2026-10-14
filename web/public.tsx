import { Link, Outlet, useParams } from 'react-router'
import { fmtDate } from '../server/domain.ts'
import { api, call, isDate, MARK, markClass, useApi } from './api.ts'

export function PublicLayout() {
  return (
    <>
      <header><Link className="brand" to="/">予約空き状況</Link><Link to="/guide">利用案内</Link><Link to="/news">お知らせ</Link></header>
      <main><Outlet /></main>
    </>
  )
}

const usePublic = (date?: string) => useApi(() => call(api.public.$get({ query: isDate(date) ? { date } : {} })), [date])

// F-01: availability only, no booking buttons.
export function Availability() {
  const { data, error } = usePublic(useParams().date)
  if (!data) return <p className="warn">{error}</p>
  return (
    <>
      <title>空き状況</title>
      {data.notice && <div className="notice">{data.notice}</div>}
      <h1>空き状況</h1>
      <p className="muted">予約は会場の受付で行います。○ 余裕あり / △ 残りわずか / × 満員</p>
      <nav className="tabs">{data.dates.map((d) => <Link key={d} to={`/day/${d}`} className={d === data.date ? 'on' : ''}>{fmtDate(d)}</Link>)}</nav>
      {data.slots.length ? (
        <table>
          <thead><tr><th>時間</th><th>状況</th><th>残り</th></tr></thead>
          <tbody>{data.slots.map((sl) => (
            <tr key={sl.id}><td>{sl.startTime}–{sl.endTime}</td><td className={`mark ${markClass(sl.status)}`}>{MARK[sl.status]}</td><td>{sl.bookable ? `${sl.remaining}名` : ''}</td></tr>
          ))}</tbody>
        </table>
      ) : <p>表示できるコマがありません。</p>}
    </>
  )
}

export function Guide() {
  return (
    <>
      <title>利用案内</title>
      <h1>利用案内</h1>
      <div className="card"><ol>
        <li>予約は<strong>会場の受付端末</strong>でのみ受け付けています。このページでは空き状況だけを確認できます。</li>
        <li>受付端末で「日付 → 時間 → 人数 → 確認」の順に選ぶと予約番号が表示されます。</li>
        <li>予約番号は<strong>画面を撮影</strong>して控えてください。スマホがない方にはスタッフが紙に書いてお渡しします。</li>
        <li>お名前や連絡先はお伺いしません。予約の取消・変更は予約番号をスタッフにお伝えください。</li>
        <li>中止や変更は「お知らせ」でお知らせします。ご来場前にご確認ください。</li>
      </ol></div>
    </>
  )
}

export function News() {
  const { data } = usePublic()
  return (
    <>
      <title>お知らせ</title>
      <h1>お知らせ</h1>
      {data && (data.notice ? <div className="notice">{data.notice}</div> : <p>現在お知らせはありません。</p>)}
    </>
  )
}
