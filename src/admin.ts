import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { html, raw } from 'hono/html'
import { renderSVG } from 'uqr'
import { getRules, getSettings, getSlots, log, markClass, page, reserve, type Env, type Html } from './common'
import {
  TOTP_SECRET, WEEKDAYS, datesBetween, fmtDate, hmac, newTotpSecret, nowJst, otpauthUri, randomToken, ruleBlocks, safeEqual, sha256, slotState, verifyTotp, weekday,
  type Rule,
} from './lib'

const admin = new Hono<Env>()
const SESSION_MS = 12 * 3600_000
const MAX_FAILS = 10 // per 15 minutes, counted globally because we keep no IP addresses
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

type Form = Record<string, string>
const form = async (c: Context) => (await c.req.parseBody()) as Form
const int = (v: string | undefined, min: number, max: number) => {
  const n = Number(v)
  return v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null
}
const opt = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : null)
const adminPage = (title: string, body: Html) => page(title, body, { mode: 'admin' })
const bad = (c: Context, msg = '入力内容が正しくありません。') =>
  c.html(adminPage('エラー', html`<h1>エラー</h1><p>${msg}</p><p><a href="javascript:history.back()">戻る</a></p>`), 400)
const back = (f: Form, fallback: string) => (f.back?.startsWith('/admin') ? f.back : fallback)

// ---------- auth ----------
// Login = 6-digit TOTP code from an authenticator app (shared account, shared secret).
// Session cookie = id.expiry.HMAC(totp_secret, id.expiry): re-issuing the secret logs everyone out, no extra secret needed.
type Admin = { id: number; totp_secret: string | null }

admin.use(async (c, next) => {
  if (c.req.path === '/admin/login') return next()
  const [id, exp, sig] = (getCookie(c, 'adm') ?? '').split('.')
  const a = Number(exp) > Date.now() && (await c.env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(Number(id)).first<Admin>())
  if (!a || !a.totp_secret || !safeEqual(await hmac(a.totp_secret, `${id}.${exp}`), sig ?? '')) return c.redirect('/admin/login')
  c.set('adminId', a.id)
  await next()
})

const loginForm = (error = '') => adminPage('ログイン', html`<h1>管理者ログイン</h1>${error ? html`<p class="warn">${error}</p>` : ''}
  <form method="post" class="card" style="max-width:360px"><p><label>認証アプリの6桁コード<br>
  <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required autofocus style="font-size:1.6em;letter-spacing:.2em;width:8em"></label></p>
  <button class="primary">ログイン</button></form>`)

admin.get('/login', (c) => c.html(loginForm()))
admin.post('/login', async (c) => {
  const db = c.env.DB
  const f = await form(c)
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'login_failed' AND at > ?").bind(nowJst(Date.now() - 15 * 60_000).iso).first<number>('n')
  if (fails! >= MAX_FAILS) return c.html(loginForm('ログイン失敗が続いたため一時的に停止しています。15分ほど待ってから再度お試しください。'), 429)
  const a = await db.prepare("SELECT * FROM admins WHERE login_id = 'admin'").first<Admin>()
  const step = a?.totp_secret ? await verifyTotp(a.totp_secret, (f.code ?? '').trim()) : null
  // Consuming the step atomically makes each code single-use.
  const fresh = step !== null && (await db.prepare('UPDATE admins SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?').bind(step, a!.id, step).run()).meta.changes
  if (!fresh) {
    await log(db, 'anonymous', null, 'login_failed')
    return c.html(loginForm('コードが違うか、使用済みです。次のコードでお試しください。'), 401)
  }
  const exp = Date.now() + SESSION_MS
  setCookie(c, 'adm', `${a!.id}.${exp}.${await hmac(a!.totp_secret!, `${a!.id}.${exp}`)}`, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/admin', maxAge: SESSION_MS / 1000 })
  await log(db, 'admin', a!.id, 'login')
  return c.redirect('/admin', 303)
})

admin.post('/logout', (c) => {
  deleteCookie(c, 'adm', { path: '/admin', secure: true })
  return c.redirect('/admin/login', 303)
})

// ---------- slots generated from templates ----------

async function generateSlots(db: D1Database) {
  const s = await getSettings(db)
  const ts = (await db.prepare('SELECT * FROM slot_templates').all<{ id: number; weekday: number; start_time: string; end_time: string; capacity: number; valid_from: string | null; valid_to: string | null }>()).results
  const stmt = db.prepare('INSERT OR IGNORE INTO slots (date, start_time, end_time, capacity, template_id) VALUES (?, ?, ?, ?, ?)')
  const batch = datesBetween(s.open_date, s.close_date).flatMap((d) =>
    ts.filter((t) => t.weekday === weekday(d) && (!t.valid_from || t.valid_from <= d) && (!t.valid_to || d <= t.valid_to))
      .map((t) => stmt.bind(d, t.start_time, t.end_time, t.capacity, t.id)))
  if (batch.length) await db.batch(batch)
}

// ---------- today / day view ----------

type ResRow = { id: number; slot_id: number; code: string; people: number; status: string; created_at: string; created_by_type: string; device_name: string | null; cancelled_at: string | null }
const RES_SQL = `SELECT r.*, d.name AS device_name FROM reservations r LEFT JOIN devices d ON r.created_by_type = 'device' AND d.id = r.created_by_id`
const by = (r: ResRow) => (r.created_by_type === 'device' ? `端末:${r.device_name ?? '?'}` : '管理者')

function resTable(rows: ResRow[], backTo: string) {
  if (!rows.length) return html`<p class="muted">予約なし</p>`
  return html`<table><tr><th>予約番号</th><th>人数</th><th>予約時刻</th><th>作成元</th><th></th></tr>
    ${rows.map((r) => html`<tr class="${r.status === 'cancelled' ? 'muted' : ''}"><td><strong>${r.code}</strong></td><td>${r.people}名</td><td>${r.created_at}</td><td>${by(r)}</td>
      <td>${r.status === 'active'
        ? html`<form class="inline" method="post" action="/admin/reservations/${r.id}/cancel" onsubmit="return confirm('予約 ${r.code} を取り消しますか？')"><input type="hidden" name="back" value="${backTo}"><button class="danger">取消</button></form>`
        : html`取消済 ${r.cancelled_at ?? ''}`}</td></tr>`)}</table>`
}

async function dayView(c: Context<Env>, date: string) {
  const db = c.env.DB
  const backTo = c.req.path
  const [s, rules, slots, res] = await Promise.all([
    getSettings(db), getRules(db), getSlots(db, 's.date = ?', date),
    db.prepare(`${RES_SQL} JOIN slots s ON s.id = r.slot_id WHERE s.date = ? ORDER BY r.created_at`).bind(date).all<ResRow>().then((r) => r.results),
  ])
  const total = slots.reduce((a, sl) => a + sl.booked, 0)
  return html`
    <p>予約合計 <strong>${total}名</strong> ／ 定員合計 ${slots.reduce((a, sl) => a + sl.capacity, 0)}名</p>
    ${slots.map((sl) => {
      const st = slotState(sl, rules, s)
      const blocked = st.mark === '受付停止'
      return html`<div class="card">
        <div class="row"><h2 style="margin:0">${sl.start_time}–${sl.end_time}</h2>
          <span class="mark ${markClass(st.mark)}">${st.mark}</span>
          <span>予約 ${sl.booked}/${sl.capacity}名（残 ${sl.capacity - sl.booked}）</span>
          ${blocked && sl.cnt ? html`<span class="warn">受付停止中ですが予約${sl.cnt}件あり</span>` : ''}
          ${sl.booked > sl.capacity ? html`<span class="warn">定員超過</span>` : ''}</div>
        ${resTable(res.filter((r) => r.slot_id === sl.id), backTo)}
        <details><summary>代理予約</summary>
          <form method="post" action="/admin/reservations" class="row"><input type="hidden" name="slot" value="${sl.id}"><input type="hidden" name="back" value="${backTo}">
            <label>人数 <input type="number" name="people" min="1" max="99" value="1" required></label>
            <label><input type="checkbox" name="overbook" value="1"> 定員超過を許可</label><button class="primary">登録</button></form></details>
        <details><summary>このコマを編集</summary>
          <form method="post" action="/admin/slots/${sl.id}" class="row"><input type="hidden" name="back" value="${backTo}">
            <input type="time" name="start_time" value="${sl.start_time}" required>–<input type="time" name="end_time" value="${sl.end_time}" required>
            <label>定員 <input type="number" name="capacity" min="0" max="999" value="${sl.capacity}" required></label>
            <select name="status"><option value="open" ${sl.status === 'open' ? 'selected' : ''}>受付中</option><option value="stopped" ${sl.status === 'stopped' ? 'selected' : ''}>停止</option></select>
            <button>保存</button></form>
          <form method="post" action="/admin/slots/${sl.id}/delete" onsubmit="return confirm('このコマを削除しますか？')"><input type="hidden" name="back" value="${backTo}"><button class="danger">コマを削除</button></form>
        </details></div>`
    })}
    ${slots.length ? '' : html`<p>この日のコマはありません。</p>`}
    <div class="card"><h2 style="margin-top:0">コマを追加</h2>
      <form method="post" action="/admin/slots" class="row"><input type="hidden" name="date" value="${date}"><input type="hidden" name="back" value="${backTo}">
        <input type="time" name="start_time" required>–<input type="time" name="end_time" required>
        <label>定員 <input type="number" name="capacity" min="0" max="999" value="8" required></label><button>追加</button></form></div>`
}

admin.get('/', async (c) => {
  const db = c.env.DB
  const today = nowJst().date
  const code = (c.req.query('code') ?? '').trim().toUpperCase()
  const found = code ? await db.prepare(`${RES_SQL} WHERE r.code = ?`).bind(code).first<ResRow>() : null
  const slot = found && (await getSlots(db, 's.id = ?', found.slot_id))[0]
  return c.html(adminPage('今日の予約', html`
    <form class="row card" method="get"><label>予約番号で検索 <input name="code" value="${code}" autocapitalize="characters" size="8"></label><button>検索</button></form>
    ${code ? html`<div class="card">${found ? html`<p>${slot ? `${fmtDate(slot.date)} ${slot.start_time}–${slot.end_time}` : ''}</p>${resTable([found], '/admin')}` : html`<p>予約番号 ${code} は見つかりません。</p>`}</div>` : ''}
    <h1>今日（${fmtDate(today)}）の予約</h1>${dayView(c, today)}`))
})

// ---------- calendar ----------

admin.get('/calendar', async (c) => {
  const db = c.env.DB
  const s = await getSettings(db)
  const q = c.req.query('month')
  const month = q && /^\d{4}-\d{2}$/.test(q) ? q : s.open_date.slice(0, 7)
  const rows = (await db.prepare(`SELECT s.date, COUNT(*) AS n, SUM(s.capacity) AS cap,
      SUM((SELECT COALESCE(SUM(people), 0) FROM reservations r WHERE r.slot_id = s.id AND r.status = 'active')) AS booked
      FROM slots s WHERE s.status != 'deleted' AND s.date LIKE ? GROUP BY s.date`).bind(`${month}-%`).all<{ date: string; n: number; cap: number; booked: number }>()).results
  const first = `${month}-01`
  const shift = (n: number) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7)
  const days = datesBetween(first, `${shift(1)}-01`).slice(0, -1)
  return c.html(adminPage('カレンダー', html`
    <div class="row"><a class="btn" href="?month=${shift(-1)}">←</a><h1 style="margin:0">${month.replace('-', '年')}月</h1><a class="btn" href="?month=${shift(1)}">→</a>
      <span class="muted">受付期間 ${s.open_date} 〜 ${s.close_date}</span></div>
    <div class="cal" style="margin-top:12px">${WEEKDAYS.map((w) => html`<div style="min-height:auto;text-align:center">${w}</div>`)}
      ${Array.from({ length: weekday(first) }, () => html`<div style="visibility:hidden"></div>`)}
      ${days.map((d) => {
        const r = rows.find((x) => x.date === d)
        const inPeriod = s.open_date <= d && d <= s.close_date
        return html`<div style="${inPeriod ? '' : 'background:#eceef1'}"><a href="/admin/calendar/${d}">${+d.slice(8)}</a>
          ${r ? html`<br>${r.n}コマ<br>${r.booked}/${r.cap}名` : ''}</div>`
      })}</div>`))
})

admin.get('/calendar/:date', async (c) => {
  const date = c.req.param('date')
  if (!DATE.test(date)) return c.redirect('/admin/calendar')
  return c.html(adminPage(fmtDate(date), html`<p><a href="/admin/calendar?month=${date.slice(0, 7)}">← カレンダー</a></p><h1>${date}（${WEEKDAYS[weekday(date)]}）</h1>${dayView(c, date)}`))
})

// ---------- slot & reservation actions ----------

admin.post('/slots', async (c) => {
  const f = await form(c)
  const date = opt(f.date, DATE), st = opt(f.start_time, TIME), et = opt(f.end_time, TIME), cap = int(f.capacity, 0, 999)
  if (!date || !st || !et || st >= et || cap === null) return bad(c)
  // Re-adding a time that was soft-deleted revives that row.
  const r = await c.env.DB.prepare(`INSERT INTO slots (date, start_time, end_time, capacity) VALUES (?, ?, ?, ?)
    ON CONFLICT (date, start_time) DO UPDATE SET end_time = excluded.end_time, capacity = excluded.capacity, status = 'open' WHERE status = 'deleted'`)
    .bind(date, st, et, cap).run()
  if (!r.meta.changes) return bad(c, 'その開始時刻のコマは既にあります。')
  await log(c.env.DB, 'admin', c.get('adminId'), 'slot_create', r.meta.last_row_id)
  return c.redirect(back(f, `/admin/calendar/${date}`), 303)
})

admin.post('/slots/:id', async (c) => {
  const f = await form(c)
  const id = Number(c.req.param('id'))
  const st = opt(f.start_time, TIME), et = opt(f.end_time, TIME), cap = int(f.capacity, 0, 999)
  if (!st || !et || st >= et || cap === null || !['open', 'stopped'].includes(f.status)) return bad(c)
  try {
    await c.env.DB.prepare("UPDATE slots SET start_time = ?, end_time = ?, capacity = ?, status = ? WHERE id = ? AND status != 'deleted'").bind(st, et, cap, f.status, id).run()
  } catch {
    return bad(c, 'その開始時刻のコマは既にあります。')
  }
  await log(c.env.DB, 'admin', c.get('adminId'), 'slot_update', id)
  return c.redirect(back(f, '/admin/calendar'), 303)
})

admin.post('/slots/:id/delete', async (c) => {
  const f = await form(c)
  const id = Number(c.req.param('id'))
  const r = await c.env.DB.prepare("UPDATE slots SET status = 'deleted' WHERE id = ? AND NOT EXISTS (SELECT 1 FROM reservations WHERE slot_id = ? AND status = 'active')").bind(id, id).run()
  if (!r.meta.changes) return bad(c, '有効な予約があるコマは削除できません。先に予約を取り消すか、コマを「停止」にしてください。')
  await log(c.env.DB, 'admin', c.get('adminId'), 'slot_delete', id)
  return c.redirect(back(f, '/admin/calendar'), 303)
})

admin.post('/reservations', async (c) => {
  const f = await form(c)
  const slot = int(f.slot, 1, Number.MAX_SAFE_INTEGER), people = int(f.people, 1, 99)
  if (!slot || !people) return bad(c)
  const code = await reserve(c.env.DB, slot, people, 'admin', c.get('adminId'), f.overbook === '1')
  if (!code) return bad(c, '定員を超えるため登録できません。必要なら「定員超過を許可」にチェックしてください。')
  return c.html(adminPage('代理予約完了', html`<h1>代理予約を登録しました</h1><div class="card"><div class="muted">予約番号</div><div class="code">${code}</div><p style="text-align:center">${people}名</p></div>
    <p><a class="btn primary" href="${back(f, '/admin')}">戻る</a></p>`))
})

admin.post('/reservations/:id/cancel', async (c) => {
  const f = await form(c)
  const id = Number(c.req.param('id'))
  const r = await c.env.DB.prepare("UPDATE reservations SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'active'").bind(nowJst().iso, id).run()
  if (r.meta.changes) await log(c.env.DB, 'admin', c.get('adminId'), 'cancel', id)
  return c.redirect(back(f, '/admin'), 303)
})

// ---------- templates ----------

admin.get('/templates', async (c) => {
  const ts = (await c.env.DB.prepare('SELECT * FROM slot_templates ORDER BY weekday, start_time').all<{ id: number; weekday: number; start_time: string; end_time: string; capacity: number; valid_from: string | null; valid_to: string | null }>()).results
  return c.html(adminPage('コマのひな形', html`<h1>コマのひな形</h1>
    <p class="muted">受付期間内の該当曜日にコマを自動作成します。ひな形を削除すると、予約のないコマも削除されます（予約のあるコマは残ります）。</p>
    <table><tr><th>曜日</th><th>時間</th><th>定員</th><th>適用期間</th><th></th></tr>
    ${ts.map((t) => html`<tr><td>${WEEKDAYS[t.weekday]}</td><td>${t.start_time}–${t.end_time}</td><td>${t.capacity}名</td><td>${t.valid_from ?? ''} 〜 ${t.valid_to ?? ''}</td>
      <td><form class="inline" method="post" action="/admin/templates/${t.id}/delete" onsubmit="return confirm('削除しますか？')"><button class="danger">削除</button></form></td></tr>`)}</table>
    <div class="card"><h2 style="margin-top:0">ひな形を追加</h2><form method="post" class="row">
      <select name="weekday">${WEEKDAYS.map((w, i) => html`<option value="${i}">${w}曜</option>`)}</select>
      <input type="time" name="start_time" required>–<input type="time" name="end_time" required>
      <label>定員 <input type="number" name="capacity" min="0" max="999" value="8" required></label>
      <label>適用 <input type="date" name="valid_from"></label>〜<input type="date" name="valid_to"><button class="primary">追加</button></form></div>`))
})

admin.post('/templates', async (c) => {
  const f = await form(c)
  const wd = int(f.weekday, 0, 6), st = opt(f.start_time, TIME), et = opt(f.end_time, TIME), cap = int(f.capacity, 0, 999)
  if (wd === null || !st || !et || st >= et || cap === null) return bad(c)
  const db = c.env.DB
  const r = await db.prepare('INSERT INTO slot_templates (weekday, start_time, end_time, capacity, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(wd, st, et, cap, opt(f.valid_from, DATE), opt(f.valid_to, DATE)).run()
  await generateSlots(db)
  await log(db, 'admin', c.get('adminId'), 'template_create', r.meta.last_row_id)
  return c.redirect('/admin/templates', 303)
})

admin.post('/templates/:id/delete', async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  await db.batch([
    db.prepare('DELETE FROM slots WHERE template_id = ? AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.slot_id = slots.id)').bind(id),
    db.prepare('UPDATE slots SET template_id = NULL WHERE template_id = ?').bind(id),
    db.prepare('DELETE FROM slot_templates WHERE id = ?').bind(id),
  ])
  await log(db, 'admin', c.get('adminId'), 'template_delete', id)
  return c.redirect('/admin/templates', 303)
})

// ---------- blackout rules ----------

const timeRange = (r: Rule) => (r.time_from ? `${r.time_from}–${r.time_to}` : '終日')

admin.get('/blackouts', async (c) => {
  const db = c.env.DB
  const [rules, slots] = await Promise.all([getRules(db), getSlots(db, '1')])
  const slotOf = (id: number | null) => slots.find((s) => s.id === id)
  const describe = (r: Rule) => {
    if (r.kind === 'once') return `${r.date_from} 〜 ${r.date_to} ${timeRange(r)}`
    if (r.kind === 'weekly') return `毎週${WEEKDAYS[r.weekday!]}曜 ${timeRange(r)}`
    if (r.kind === 'monthly') return `毎月第${r.nth}${WEEKDAYS[r.weekday!]}曜 ${timeRange(r)}`
    const s = slotOf(r.slot_id)
    return s ? `${fmtDate(s.date)} ${s.start_time} のコマ` : '（削除済みのコマ）'
  }
  const wdSelect = html`<select name="weekday">${WEEKDAYS.map((w, i) => html`<option value="${i}">${w}曜</option>`)}</select>`
  const times = html`<label>時間帯 <input type="time" name="time_from">–<input type="time" name="time_to"></label><span class="muted">（空欄で終日）</span>`
  const memo = html`<input name="memo" placeholder="内部メモ（個人情報は書かない）" maxlength="100">`
  const today = nowJst().date
  return c.html(adminPage('受付不可ルール', html`<h1>受付不可ルール</h1>
    <p class="muted">ルールに該当するコマは「受付停止」になります。既存の予約は消えません。</p>
    <table><tr><th>内容</th><th>メモ</th><th>影響する予約</th><th></th></tr>
    ${rules.map((r) => {
      const n = slots.filter((s) => ruleBlocks(r, s)).reduce((a, s) => a + s.cnt, 0)
      return html`<tr><td>${describe(r)}</td><td>${r.memo}</td><td>${n ? html`<span class="warn">予約${n}件あり</span>` : '0件'}</td>
        <td><form class="inline" method="post" action="/admin/blackouts/${r.id}/delete" onsubmit="return confirm('削除しますか？')"><button class="danger">削除</button></form></td></tr>`
    })}</table>
    <div class="card"><h2 style="margin-top:0">単発の期間</h2><form method="post" action="/admin/blackouts" class="row"><input type="hidden" name="kind" value="once">
      <input type="date" name="date_from" required>〜<input type="date" name="date_to" required>${times}${memo}<button class="primary">追加</button></form></div>
    <div class="card"><h2 style="margin-top:0">毎週の繰り返し</h2><form method="post" action="/admin/blackouts" class="row"><input type="hidden" name="kind" value="weekly">
      毎週${wdSelect}${times}${memo}<button class="primary">追加</button></form></div>
    <div class="card"><h2 style="margin-top:0">毎月の繰り返し</h2><form method="post" action="/admin/blackouts" class="row"><input type="hidden" name="kind" value="monthly">
      毎月第<select name="nth">${[1, 2, 3, 4, 5].map((n) => html`<option>${n}</option>`)}</select>${wdSelect}${times}${memo}<button class="primary">追加</button></form></div>
    <div class="card"><h2 style="margin-top:0">特定コマのみ</h2><form method="post" action="/admin/blackouts" class="row"><input type="hidden" name="kind" value="slot">
      <select name="slot_id" required>${slots.filter((s) => s.date >= today).map((s) => html`<option value="${s.id}">${fmtDate(s.date)} ${s.start_time}–${s.end_time}</option>`)}</select>
      ${memo}<button class="primary">追加</button></form></div>`))
})

admin.post('/blackouts', async (c) => {
  const f = await form(c)
  const tf = opt(f.time_from, TIME), tt = opt(f.time_to, TIME)
  if (!tf !== !tt || (tf && tf >= tt!)) return bad(c, '時間帯は開始・終了の両方を入力してください（または両方空欄）。')
  const r = { kind: f.kind, date_from: null as string | null, date_to: null as string | null, weekday: null as number | null, nth: null as number | null, slot_id: null as number | null }
  if (f.kind === 'once') { r.date_from = opt(f.date_from, DATE); r.date_to = opt(f.date_to, DATE); if (!r.date_from || !r.date_to || r.date_from > r.date_to) return bad(c) }
  else if (f.kind === 'weekly') { r.weekday = int(f.weekday, 0, 6); if (r.weekday === null) return bad(c) }
  else if (f.kind === 'monthly') { r.weekday = int(f.weekday, 0, 6); r.nth = int(f.nth, 1, 5); if (r.weekday === null || !r.nth) return bad(c) }
  else if (f.kind === 'slot') { r.slot_id = int(f.slot_id, 1, Number.MAX_SAFE_INTEGER); if (!r.slot_id) return bad(c) }
  else return bad(c)
  const res = await c.env.DB.prepare('INSERT INTO blackout_rules (kind, date_from, date_to, weekday, nth, time_from, time_to, slot_id, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(r.kind, r.date_from, r.date_to, r.weekday, r.nth, r.kind === 'slot' ? null : tf, r.kind === 'slot' ? null : tt, r.slot_id, (f.memo ?? '').slice(0, 100)).run()
  await log(c.env.DB, 'admin', c.get('adminId'), 'blackout_create', res.meta.last_row_id)
  return c.redirect('/admin/blackouts', 303)
})

admin.post('/blackouts/:id/delete', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM blackout_rules WHERE id = ?').bind(id).run()
  await log(c.env.DB, 'admin', c.get('adminId'), 'blackout_delete', id)
  return c.redirect('/admin/blackouts', 303)
})

// ---------- settings ----------

admin.get('/settings', async (c) => {
  const s = await getSettings(c.env.DB)
  const msg = c.req.query('ok') ? html`<p class="card">保存しました。</p>` : ''
  return c.html(adminPage('全体設定', html`<h1>全体設定</h1>${msg}
    <form method="post" class="card">
      <p><label>受付期間 <input type="date" name="open_date" value="${s.open_date}" required></label> 〜 <input type="date" name="close_date" value="${s.close_date}" required></p>
      <p><label>1予約あたりの最大人数 <input type="number" name="max_people" min="1" max="50" value="${s.max_people}" required> 名</label></p>
      <p><label>自動リセット <input type="number" name="reset_seconds" min="10" max="600" value="${s.reset_seconds}" required> 秒</label></p>
      <p><label>お知らせ（公開ページに表示）<br><textarea name="notice" rows="4" style="width:100%" maxlength="1000">${s.notice}</textarea></label></p>
      <button class="primary">保存</button></form>
    <div class="card"><h2 style="margin-top:0">ログイン用OTP</h2><p><a href="/admin/otp">認証アプリの追加・再発行</a></p></div>`))
})

admin.post('/settings', async (c) => {
  const f = await form(c)
  const od = opt(f.open_date, DATE), cd = opt(f.close_date, DATE), mp = int(f.max_people, 1, 50), rs = int(f.reset_seconds, 10, 600)
  if (!od || !cd || od > cd || !mp || !rs) return bad(c)
  const db = c.env.DB
  await db.prepare('UPDATE settings SET open_date = ?, close_date = ?, max_people = ?, reset_seconds = ?, notice = ? WHERE id = 1').bind(od, cd, mp, rs, (f.notice ?? '').slice(0, 1000)).run()
  await generateSlots(db)
  await log(db, 'admin', c.get('adminId'), 'settings_update')
  return c.redirect('/admin/settings?ok=1', 303)
})

// ---------- OTP (authenticator app) ----------

const qr = (secret: string) => html`<div style="max-width:260px">${raw(renderSVG(otpauthUri(secret)))}</div><p class="muted">手入力用キー: <code>${secret}</code></p>`

admin.get('/otp', async (c) => {
  const a = await c.env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(c.get('adminId')).first<Admin>()
  if (c.req.query('new')) {
    const secret = newTotpSecret()
    return c.html(adminPage('OTPの再発行', html`<h1>OTPの再発行</h1>
      <p>新しいQRを認証アプリで読み取り、表示された6桁を入力して確定してください。確定すると<strong>古いコードは使えなくなり、全員ログアウト</strong>されます。</p>
      <div class="card">${qr(secret)}<form method="post" class="row"><input type="hidden" name="secret" value="${secret}">
        <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required placeholder="6桁コード"><button class="primary">確定</button></form></div>
      <p><a href="/admin/otp">やめる</a></p>`))
  }
  return c.html(adminPage('ログイン用OTP', html`<h1>ログイン用OTP</h1>
    <p>メンバーのスマホに認証アプリ（Google Authenticator など）を入れ、このQRを読み取るとログインできるようになります。<strong>このQRは管理者ログインそのものなので、メンバー以外に見せないでください。</strong></p>
    <div class="card">${qr(a!.totp_secret!)}</div>
    <div class="card"><h2 style="margin-top:0">再発行</h2><p>スマホの紛失やメンバーの交代時に使います。全員が読み取り直す必要があります。</p><a class="btn" href="/admin/otp?new=1">再発行する</a></div>`))
})

admin.post('/otp', async (c) => {
  const f = await form(c)
  if (!TOTP_SECRET.test(f.secret ?? '')) return bad(c)
  const step = await verifyTotp(f.secret, (f.code ?? '').trim())
  if (step === null) return bad(c, 'コードが違います。QRを読み取り直して、表示中のコードを入力してください。')
  await c.env.DB.prepare('UPDATE admins SET totp_secret = ?, totp_last_step = ? WHERE id = ?').bind(f.secret, step, c.get('adminId')).run()
  await log(c.env.DB, 'admin', c.get('adminId'), 'otp_reset')
  return c.redirect('/admin/login', 303)
})

// ---------- kiosk devices ----------

admin.get('/devices', async (c) => {
  const db = c.env.DB
  const devices = (await db.prepare('SELECT id, name, created_at, active, token_hash FROM devices ORDER BY id').all<{ id: number; name: string; created_at: string; active: number; token_hash: string }>()).results
  const token = getCookie(c, 'dev')
  const myHash = token ? await sha256(token) : ''
  const current = devices.find((d) => d.token_hash === myHash)
  return c.html(adminPage('受付端末', html`<h1>受付端末</h1>
    <div class="card">${current
      ? html`<p>この端末は「<strong>${current.name}</strong>」として${current.active ? '登録済み' : '登録されていますが無効'}です。</p><p><a class="btn primary" href="/kiosk">予約画面を開く</a></p>`
      : html`<h2 style="margin-top:0">この端末を受付端末として登録</h2><p class="muted">受付に置くiPad/PCでこの画面を開いて登録し、ログアウトしてから /kiosk を開いてください。</p>
        <form method="post" class="row"><input name="name" placeholder="端末名（例：受付iPad 1）" required maxlength="40"><button class="primary">登録</button></form>`}</div>
    <table><tr><th>端末名</th><th>登録日時</th><th>状態</th><th></th></tr>
    ${devices.map((d) => html`<tr><td><form class="row" method="post" action="/admin/devices/${d.id}"><input name="name" value="${d.name}" required maxlength="40"><button>名前変更</button></form></td>
      <td>${d.created_at}</td><td>${d.active ? '有効' : html`<span class="muted">無効</span>`}</td>
      <td><form class="inline" method="post" action="/admin/devices/${d.id}/${d.active ? 'disable' : 'enable'}"><button class="${d.active ? 'danger' : ''}">${d.active ? '無効化' : '有効化'}</button></form></td></tr>`)}</table>`))
})

admin.post('/devices', async (c) => {
  const f = await form(c)
  const name = (f.name ?? '').trim().slice(0, 40)
  if (!name) return bad(c)
  const token = randomToken()
  const r = await c.env.DB.prepare('INSERT INTO devices (name, token_hash, created_at) VALUES (?, ?, ?)').bind(name, await sha256(token), nowJst().iso).run()
  setCookie(c, 'dev', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 86400 })
  await log(c.env.DB, 'admin', c.get('adminId'), 'device_register', r.meta.last_row_id)
  return c.redirect('/admin/devices', 303)
})

admin.post('/devices/:id', async (c) => {
  const f = await form(c)
  const id = Number(c.req.param('id'))
  const name = (f.name ?? '').trim().slice(0, 40)
  if (!name) return bad(c)
  await c.env.DB.prepare('UPDATE devices SET name = ? WHERE id = ?').bind(name, id).run()
  await log(c.env.DB, 'admin', c.get('adminId'), 'device_rename', id)
  return c.redirect('/admin/devices', 303)
})

admin.post('/devices/:id/:op{disable|enable}', async (c) => {
  const id = Number(c.req.param('id'))
  const op = c.req.param('op')
  await c.env.DB.prepare('UPDATE devices SET active = ? WHERE id = ?').bind(op === 'enable' ? 1 : 0, id).run()
  await log(c.env.DB, 'admin', c.get('adminId'), `device_${op}`, id)
  return c.redirect('/admin/devices', 303)
})

// ---------- audit log ----------

const ACTIONS: Record<string, string> = {
  reserve: '予約', reserve_overbook: '予約（定員超過許可）', cancel: '予約取消', login: 'ログイン', login_failed: 'ログイン失敗',
  slot_create: 'コマ追加', slot_update: 'コマ編集', slot_delete: 'コマ削除', template_create: 'ひな形追加', template_delete: 'ひな形削除',
  blackout_create: '受付不可追加', blackout_delete: '受付不可削除', settings_update: '全体設定変更', otp_reset: 'OTP再発行',
  device_register: '端末登録', device_rename: '端末名変更', device_disable: '端末無効化', device_enable: '端末有効化',
}

admin.get('/logs', async (c) => {
  const rows = (await c.env.DB.prepare(`SELECT l.*, d.name AS device_name, a.login_id FROM audit_logs l
      LEFT JOIN devices d ON l.actor_type = 'device' AND d.id = l.actor_id LEFT JOIN admins a ON l.actor_type = 'admin' AND a.id = l.actor_id
      ORDER BY l.id DESC LIMIT 500`).all<{ at: string; actor_type: string; device_name: string | null; login_id: string | null; action: string; target_id: number | null }>()).results
  const actor = (r: (typeof rows)[number]) => (r.actor_type === 'device' ? `端末:${r.device_name}` : r.actor_type === 'admin' ? `管理者:${r.login_id}` : '—')
  return c.html(adminPage('操作ログ', html`<h1>操作ログ</h1><p class="muted">直近500件</p>
    <table><tr><th>日時</th><th>操作者</th><th>操作</th><th>対象ID</th></tr>
    ${rows.map((r) => html`<tr><td>${r.at}</td><td>${actor(r)}</td><td>${ACTIONS[r.action] ?? r.action}</td><td>${r.target_id ?? ''}</td></tr>`)}</table>`))
})

export default admin
