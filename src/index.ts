import { Hono, type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { html } from 'hono/html'
import admin from './admin.ts'
import { book } from './booking.ts'
import { eventDates, getRules, getSettings, getSlots, markClass, page, type Env } from './common.ts'
import { fmtDate, nowJst, sha256, slotState } from './lib.ts'

const app = new Hono<Env>()
const DATE = /^\d{4}-\d{2}-\d{2}$/

app.use(csrf())
app.use(async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'same-origin')
})

// ---------- public (read only) ----------

async function dayPage(c: Context<Env>, date?: string) {
  const db = c.env.DB
  const [s, rules] = await Promise.all([getSettings(db), getRules(db)])
  const dates = await eventDates(db, s)
  const today = nowJst().date
  if (!date || !DATE.test(date)) date = dates.find((d) => d >= today) ?? dates[0]
  const slots = date ? await getSlots(db, 's.date = ?', date) : []
  const body = html`
    ${s.notice ? html`<div class="notice">${s.notice}</div>` : ''}
    <h1>空き状況</h1>
    <p class="muted">予約は会場の受付で行います。○ 余裕あり / △ 残りわずか / × 満員</p>
    <nav class="tabs">${dates.map((d) => html`<a href="/day/${d}" class="${d === date ? 'on' : ''}">${fmtDate(d)}</a>`)}</nav>
    ${slots.length
      ? html`<table><tr><th>時間</th><th>状況</th><th>残り</th></tr>
        ${slots.map((sl) => {
          const st = slotState(sl, rules, s)
          return html`<tr><td>${sl.start_time}–${sl.end_time}</td><td class="mark ${markClass(st.mark)}">${st.mark}</td>
            <td>${st.bookable ? `${st.remaining}名` : ''}</td></tr>`
        })}</table>`
      : html`<p>表示できるコマがありません。</p>`}`
  return c.html(page('空き状況', body))
}

app.get('/', (c) => dayPage(c, c.req.query('date')))
app.get('/day/:date', (c) => dayPage(c, c.req.param('date')))

app.get('/guide', (c) =>
  c.html(page('利用案内', html`<h1>利用案内</h1><div class="card">
    <ol>
      <li>予約は<strong>会場の受付端末</strong>でのみ受け付けています。このページでは空き状況だけを確認できます。</li>
      <li>受付端末で「日付 → 時間 → 人数 → 確認」の順に選ぶと予約番号が表示されます。</li>
      <li>予約番号は<strong>画面を撮影</strong>して控えてください。スマホがない方にはスタッフが紙に書いてお渡しします。</li>
      <li>お名前や連絡先はお伺いしません。予約の取消・変更は予約番号をスタッフにお伝えください。</li>
      <li>中止や変更は「お知らせ」でお知らせします。ご来場前にご確認ください。</li>
    </ol></div>`)),
)

app.get('/news', async (c) => {
  const s = await getSettings(c.env.DB)
  return c.html(page('お知らせ', html`<h1>お知らせ</h1>${s.notice ? html`<div class="notice">${s.notice}</div>` : html`<p>現在お知らせはありません。</p>`}`))
})

// ---------- kiosk (registered devices only) ----------

const kiosk = new Hono<Env>()

kiosk.use(async (c, next) => {
  const token = getCookie(c, 'dev')
  const dev = token && (await c.env.DB.prepare('SELECT id FROM devices WHERE token_hash = ? AND active = 1').bind(await sha256(token)).first<{ id: number }>())
  if (!dev) return c.redirect('/')
  c.set('deviceId', dev.id)
  await next()
})

const kioskPage = (title: string, body: Parameters<typeof page>[1], resetSeconds?: number) => page(title, body, { mode: 'kiosk', resetSeconds })

kiosk.get('/', async (c) => {
  const s = await getSettings(c.env.DB)
  const dates = (await eventDates(c.env.DB, s)).filter((d) => d >= nowJst().date)
  return c.html(kioskPage('予約受付', html`
    ${s.notice ? html`<div class="notice">${s.notice}</div>` : ''}
    <h1>ご予約の日付を選んでください</h1>
    <div class="big">${dates.map((d) => html`<a href="/kiosk/${d}">${fmtDate(d)}</a>`)}</div>
    ${dates.length ? '' : html`<p>現在受付中の日付はありません。</p>`}`))
})

kiosk.get('/done', async (c) => {
  const db = c.env.DB
  const [s, r] = await Promise.all([
    getSettings(db),
    db.prepare('SELECT r.code, r.people, s.date, s.start_time, s.end_time FROM reservations r JOIN slots s ON s.id = r.slot_id WHERE r.code = ?')
      .bind(c.req.query('code') ?? '').first<{ code: string; people: number; date: string; start_time: string; end_time: string }>(),
  ])
  if (!r) return c.redirect('/kiosk')
  return c.html(kioskPage('予約完了', html`
    <h1>予約が完了しました</h1>
    <p>予約番号を<strong>画面ごと撮影</strong>するか、スタッフにお知らせください。</p>
    <div class="card"><div class="muted">予約番号</div><div class="code">${r.code}</div>
      <p style="text-align:center;font-size:1.4em">${fmtDate(r.date)} ${r.start_time}–${r.end_time} ／ ${r.people}名</p></div>
    <div class="actions"><a class="btn primary" href="/kiosk">トップへ戻る（<span id="cd">${s.reset_seconds}</span>秒）</a></div>
    <script>(()=>{let n=${s.reset_seconds};setInterval(()=>{n--;document.getElementById('cd').textContent=n;if(n<=0)location.replace('/kiosk')},1000)})()</script>`))
})

kiosk.get('/:date', async (c) => {
  const date = c.req.param('date')
  if (!DATE.test(date)) return c.redirect('/kiosk')
  const db = c.env.DB
  const [s, rules, slots] = await Promise.all([getSettings(db), getRules(db), getSlots(db, 's.date = ?', date)])
  return c.html(kioskPage('時間を選択', html`
    <h1>${fmtDate(date)} の時間を選んでください</h1>
    <div class="big">${slots.map((sl) => {
      const st = slotState(sl, rules, s)
      const label = html`${sl.start_time}–${sl.end_time}<small>${st.bookable ? `残り${st.remaining}名` : st.mark === '×' ? '満員' : st.mark}</small>`
      return st.bookable ? html`<a href="/kiosk/${date}/${sl.id}">${label}</a>` : html`<span aria-disabled="true">${label}</span>`
    })}</div>
    <div class="actions"><a class="btn" href="/kiosk">← 日付を選び直す</a></div>`, s.reset_seconds))
})

kiosk.get('/:date/:slot', async (c) => {
  const date = c.req.param('date')
  const db = c.env.DB
  const [s, rules, [slot]] = await Promise.all([getSettings(db), getRules(db), getSlots(db, 's.id = ? AND s.date = ?', Number(c.req.param('slot')), date)])
  const st = slot && slotState(slot, rules, s)
  if (!slot || !st.bookable) return c.redirect(DATE.test(date) ? `/kiosk/${date}` : '/kiosk')
  const max = Math.min(s.max_people, st.remaining)
  const n = Number(c.req.query('n'))
  const when = `${fmtDate(date)} ${slot.start_time}–${slot.end_time}`

  if (!(Number.isInteger(n) && n >= 1 && n <= max)) {
    return c.html(kioskPage('人数を選択', html`
      <h1>人数を選んでください</h1><p>${when}（残り${st.remaining}名）</p>
      <div class="big">${Array.from({ length: max }, (_, i) => html`<a href="?n=${i + 1}">${i + 1}名</a>`)}</div>
      <div class="actions"><a class="btn" href="/kiosk/${date}">← 時間を選び直す</a></div>`, s.reset_seconds))
  }
  // F-07: confirm step with an always-visible back button; submit disables itself.
  return c.html(kioskPage('内容の確認', html`
    <h1>この内容で予約しますか？</h1>
    <div class="card" style="font-size:1.3em"><p>日時：${when}</p><p>人数：${n}名</p></div>
    <form method="post" action="/kiosk/reserve" onsubmit="this.querySelector('button[type=submit]').disabled=true">
      <input type="hidden" name="slot" value="${slot.id}"><input type="hidden" name="people" value="${n}"><input type="hidden" name="date" value="${date}">
      <div class="actions"><a class="btn" href="/kiosk/${date}/${slot.id}">← 戻る</a><button type="submit" class="primary">予約を確定する</button></div>
    </form>`, s.reset_seconds))
})

kiosk.post('/reserve', async (c) => {
  const f = (await c.req.parseBody()) as Record<string, string>
  const r = await book(c.env.DB, { slotId: Number(f.slot), people: Number(f.people), by: { type: 'device', id: c.get('deviceId') } })
  if (r.ok) return c.redirect(`/kiosk/done?code=${r.code}`, 303)
  const s = await getSettings(c.env.DB)
  const why = r.reason === 'full' ? '直前に他の方の予約が入り、定員に達しました。' : r.reason === 'unavailable' ? 'このコマは受付を停止しました。' : '選択内容が正しくありません。'
  return c.html(kioskPage('予約できませんでした', html`
    <h1>予約できませんでした</h1><p>${why}お手数ですが選び直してください。</p>
    <div class="actions"><a class="btn primary" href="${DATE.test(f.date ?? '') ? `/kiosk/${f.date}` : '/kiosk'}">時間を選び直す</a></div>`, s.reset_seconds), 409)
})

app.route('/kiosk', kiosk)
app.route('/admin', admin)

export default app
