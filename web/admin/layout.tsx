import { useState, type FormEvent } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { act, api, call } from '../api.ts'

export function AdminLayout() {
  const navigate = useNavigate()
  return (
    <>
      <meta name="robots" content="noindex" />
      <header>
        <Link className="brand" to="/admin">管理</Link><Link to="/admin/calendar">カレンダー</Link><Link to="/admin/templates">ひな形</Link>
        <Link to="/admin/blackouts">受付不可</Link><Link to="/admin/settings">全体設定</Link><Link to="/admin/devices">受付端末</Link><Link to="/admin/logs">操作ログ</Link>
        <button onClick={() => act(() => call(api.admin.logout.$post()), () => navigate('/admin/login'))}>ログアウト</button>
      </header>
      <main><Outlet /></main>
    </>
  )
}

export function Login() {
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('code'))
    try {
      await call(api.admin.login.$post({ json: { code } }))
      navigate('/admin')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <main>
      <meta name="robots" content="noindex" />
      <title>ログイン</title>
      <h1>管理者ログイン</h1>
      {error && <p className="warn">{error}</p>}
      <form onSubmit={submit} className="card" style={{ maxWidth: 360 }}>
        <p><label>認証アプリの6桁コード<br />
          <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus style={{ fontSize: '1.6em', letterSpacing: '.2em', width: '8em' }} />
        </label></p>
        <button className="primary">ログイン</button>
      </form>
    </main>
  )
}
