import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { act, api, call, onSubmit, useApi } from '../api.ts'

export function Settings() {
  const { data, reload } = useApi(() => call(api.admin.settings.$get()), [])
  const [saved, setSaved] = useState(false)
  if (!data) return null
  return (
    <>
      <title>全体設定</title>
      <h1>全体設定</h1>
      {saved && <p className="card">保存しました。</p>}
      <form className="card" onSubmit={onSubmit((json) => call(api.admin.settings.$put({ json })).then(() => setSaved(true)), reload)}>
        <p><label>受付期間 <input type="date" name="openDate" defaultValue={data.openDate} required /></label> 〜 <input type="date" name="closeDate" defaultValue={data.closeDate} required /></p>
        <p><label>1予約あたりの最大人数 <input type="number" name="maxPeople" min={1} max={50} defaultValue={data.maxPeople} required /> 名</label></p>
        <p><label>自動リセット <input type="number" name="resetSeconds" min={10} max={600} defaultValue={data.resetSeconds} required /> 秒</label></p>
        <p><label>お知らせ（公開ページに表示）<br /><textarea name="notice" rows={4} style={{ width: '100%' }} maxLength={1000} defaultValue={data.notice} /></label></p>
        <button className="primary">保存</button>
      </form>
      <div className="card"><h2 style={{ marginTop: 0 }}>ログイン用OTP</h2><p><Link to="/admin/otp">認証アプリの追加・再発行</Link></p></div>
    </>
  )
}

const Qr = ({ secret, svg }: { secret: string; svg: string }) => (
  <><div className="qr" dangerouslySetInnerHTML={{ __html: svg }} /><p className="muted">手入力用キー: <code>{secret}</code></p></>
)

export function Otp() {
  const current = useApi(() => call(api.admin.otp.$get()), [])
  const [fresh, setFresh] = useState<{ secret: string; svg: string }>()
  const navigate = useNavigate()
  if (fresh) {
    return (
      <>
        <title>OTPの再発行</title>
        <h1>OTPの再発行</h1>
        <p>新しいQRを認証アプリで読み取り、表示された6桁を入力して確定してください。確定すると<strong>古いコードは使えなくなり、全員ログアウト</strong>されます。</p>
        <div className="card"><Qr {...fresh} />
          <form className="row" onSubmit={onSubmit((json) => call(api.admin.otp.$post({ json })), () => navigate('/admin/login'))}>
            <input type="hidden" name="secret" value={fresh.secret} />
            <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required placeholder="6桁コード" /><button className="primary">確定</button>
          </form>
        </div>
        <p><button onClick={() => setFresh(undefined)}>やめる</button></p>
      </>
    )
  }
  return (
    <>
      <title>ログイン用OTP</title>
      <h1>ログイン用OTP</h1>
      <p>メンバーのスマホに認証アプリ（Google Authenticator など）を入れ、このQRを読み取るとログインできるようになります。<strong>このQRは管理者ログインそのものなので、メンバー以外に見せないでください。</strong></p>
      <div className="card">{current.data && <Qr {...current.data} />}</div>
      <div className="card"><h2 style={{ marginTop: 0 }}>再発行</h2><p>スマホの紛失やメンバーの交代時に使います。全員が読み取り直す必要があります。</p>
        <button onClick={() => act(() => call(api.admin.otp.new.$get()).then(setFresh))}>再発行する</button></div>
    </>
  )
}

export function Devices() {
  const { data, reload } = useApi(() => call(api.admin.devices.$get()), [])
  if (!data) return null
  const current = data.devices.find((d) => d.id === data.currentId)
  return (
    <>
      <title>受付端末</title>
      <h1>受付端末</h1>
      <div className="card">{current
        ? <><p>この端末は「<strong>{current.name}</strong>」として{current.active ? '登録済み' : '登録されていますが無効'}です。</p><p><Link className="btn primary" to="/kiosk">予約画面を開く</Link></p></>
        : <><h2 style={{ marginTop: 0 }}>この端末を受付端末として登録</h2><p className="muted">受付に置くiPad/PCでこの画面を開いて登録し、ログアウトしてから /kiosk を開いてください。</p>
          <form className="row" onSubmit={onSubmit((json) => call(api.admin.devices.$post({ json })), reload)}>
            <input name="name" placeholder="端末名（例：受付iPad 1）" required maxLength={40} /><button className="primary">登録</button>
          </form></>}
      </div>
      <table>
        <thead><tr><th>端末名</th><th>登録日時</th><th>状態</th><th></th></tr></thead>
        <tbody>{data.devices.map((d) => {
          const id = { param: { id: String(d.id) } }
          return (
            <tr key={d.id}>
              <td><form className="row" onSubmit={onSubmit((json) => call(api.admin.devices[':id'].$put({ ...id, json })), reload)}>
                <input name="name" defaultValue={d.name} required maxLength={40} /><button>名前変更</button></form></td>
              <td>{d.createdAt}</td><td>{d.active ? '有効' : <span className="muted">無効</span>}</td>
              <td><button className={d.active ? 'danger' : ''} onClick={() => act(() => call(api.admin.devices[':id'].active.$post({ ...id, json: { active: !d.active } })), reload)}>
                {d.active ? '無効化' : '有効化'}</button></td>
            </tr>
          )
        })}</tbody>
      </table>
    </>
  )
}

const ACTIONS: Record<string, string> = {
  reserve: '予約', reserve_overbook: '予約（定員超過許可）', cancel: '予約取消', login: 'ログイン', login_failed: 'ログイン失敗',
  slot_create: 'コマ追加', slot_update: 'コマ編集', slot_delete: 'コマ削除', slot_stop: 'コマ受付停止', slot_resume: 'コマ受付再開',
  template_create: 'ひな形追加', template_delete: 'ひな形削除', blackout_create: '受付不可追加', blackout_delete: '受付不可削除',
  settings_update: '全体設定変更', otp_reset: 'OTP再発行',
  device_register: '端末登録', device_rename: '端末名変更', device_disable: '端末無効化', device_enable: '端末有効化',
}

export function Logs() {
  const { data } = useApi(() => call(api.admin.logs.$get()), [])
  return (
    <>
      <title>操作ログ</title>
      <h1>操作ログ</h1><p className="muted">直近500件</p>
      <table>
        <thead><tr><th>日時</th><th>操作者</th><th>操作</th><th>対象ID</th></tr></thead>
        <tbody>{data?.map((r) => (
          <tr key={r.id}>
            <td>{r.at}</td>
            <td>{r.actorType === 'device' ? `端末:${r.deviceName}` : r.actorType === 'admin' ? `管理者:${r.loginId}` : '—'}</td>
            <td>{ACTIONS[r.action] ?? r.action}</td><td>{r.targetId ?? ''}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  )
}
