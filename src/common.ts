import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { newCode, nowJst, type Rule, type Settings, type Slot } from './lib'

export type Env = { Bindings: { DB: D1Database }; Variables: { adminId: number; deviceId: number } }
export type Html = HtmlEscapedString | Promise<HtmlEscapedString>

export const getSettings = (db: D1Database) => db.prepare('SELECT * FROM settings WHERE id = 1').first<Settings>() as Promise<Settings>
export const getRules = async (db: D1Database) => (await db.prepare('SELECT * FROM blackout_rules').all<Rule>()).results

export async function getSlots(db: D1Database, where: string, ...binds: unknown[]) {
  const sql = `SELECT s.*, (SELECT COALESCE(SUM(people), 0) FROM reservations r WHERE r.slot_id = s.id AND r.status = 'active') AS booked,
      (SELECT COUNT(*) FROM reservations r WHERE r.slot_id = s.id AND r.status = 'active') AS cnt
    FROM slots s WHERE s.status != 'deleted' AND ${where} ORDER BY s.date, s.start_time`
  return (await db.prepare(sql).bind(...binds).all<Slot & { cnt: number }>()).results
}

// Dates in the reception period that have at least one slot.
export async function eventDates(db: D1Database, s: Settings) {
  const sql = "SELECT DISTINCT date FROM slots WHERE status != 'deleted' AND date BETWEEN ? AND ? ORDER BY date"
  return (await db.prepare(sql).bind(s.open_date, s.close_date).all<{ date: string }>()).results.map((r) => r.date)
}

export const log = (db: D1Database, actorType: string, actorId: number | null, action: string, targetId: number | null = null) =>
  db.prepare('INSERT INTO audit_logs (at, actor_type, actor_id, action, target_id) VALUES (?, ?, ?, ?, ?)')
    .bind(nowJst().iso, actorType, actorId, action, targetId).run()

// F-06: capacity is re-checked inside the INSERT itself. D1 runs each statement atomically
// against a single writer, so two kiosks racing for the last seat cannot both succeed.
export async function reserve(db: D1Database, slotId: number, people: number, by: 'device' | 'admin', byId: number, allowOver = false) {
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    try {
      const r = await db.prepare(`INSERT INTO reservations (slot_id, people, code, created_at, created_by_type, created_by_id)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM slots WHERE id = ?1 AND status != 'deleted') AND (?7
          OR (SELECT capacity FROM slots WHERE id = ?1) - (SELECT COALESCE(SUM(people), 0) FROM reservations WHERE slot_id = ?1 AND status = 'active') >= ?2)`)
        .bind(slotId, people, code, nowJst().iso, by, byId, allowOver ? 1 : 0).run()
      if (!r.meta.changes) return null
      await log(db, by, byId, allowOver ? 'reserve_overbook' : 'reserve', r.meta.last_row_id)
      return code
    } catch (e) {
      if (!String(e).includes('UNIQUE')) throw e // code collision → retry with a new code
    }
  }
  throw new Error('could not allocate a reservation code')
}

const CSS = `
:root{--fg:#1d2433;--muted:#5d6678;--bg:#f6f7f9;--card:#fff;--line:#d9dde4;--accent:#1f5fbf;--ok:#1d7a3a;--warn:#b26a00;--ng:#9aa1ad;--danger:#b3261e}
*{box-sizing:border-box}
body{margin:0;font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic UI",system-ui,sans-serif;color:var(--fg);background:var(--bg);line-height:1.7;font-size:17px}
header{background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}
header a{color:var(--fg);text-decoration:none}header .brand{font-weight:700;margin-right:auto}
main{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;margin:.4em 0}h2{font-size:1.15rem;margin:1.2em 0 .4em}
a{color:var(--accent)}
table{width:100%;border-collapse:collapse;background:var(--card)}th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}
.notice{background:#fff8e1;border:1px solid #f0d58a;border-radius:10px;padding:12px 16px;white-space:pre-wrap}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tabs a{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);text-decoration:none;color:var(--fg)}.tabs a.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.mark{font-weight:700;font-size:1.2em}.m-ok{color:var(--ok)}.m-few{color:var(--warn)}.m-ng{color:var(--ng)}
button,.btn{font:inherit;min-height:44px;padding:8px 16px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;text-decoration:none;display:inline-block}
button.primary,.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}button.danger{color:var(--danger);border-color:var(--danger)}
input,select,textarea{font:inherit;min-height:40px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;max-width:100%}
form.inline{display:inline}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.warn{color:var(--danger);font-weight:700}.muted{color:var(--muted)}
.kiosk{font-size:22px}.kiosk main{max-width:900px}
.big{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin:20px 0}
.big a,.big span,.big button{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:110px;font-size:1.3em;border-radius:14px;border:2px solid var(--accent);background:var(--card);color:var(--fg);text-decoration:none;padding:12px}
.big span{border-color:var(--line);background:#eceef1;color:var(--ng)}
.big small{font-size:.65em;color:var(--muted)}
.kiosk .actions{display:flex;gap:16px;margin-top:24px}.kiosk .actions>*{flex:1;min-height:80px;font-size:1.2em;display:flex;align-items:center;justify-content:center}
.code{font-size:5rem;font-weight:800;letter-spacing:.15em;text-align:center;font-family:ui-monospace,Menlo,monospace}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cal div{background:var(--card);border:1px solid var(--line);min-height:70px;padding:4px;font-size:.85em}
`

type PageOpts = { mode?: 'public' | 'kiosk' | 'admin'; resetSeconds?: number }

export function page(title: string, body: Html, { mode = 'public', resetSeconds }: PageOpts = {}) {
  const nav =
    mode === 'public'
      ? html`<header><a class="brand" href="/">予約空き状況</a><a href="/guide">利用案内</a><a href="/news">お知らせ</a></header>`
      : mode === 'admin'
        ? html`<header><a class="brand" href="/admin">管理</a><a href="/admin/calendar">カレンダー</a><a href="/admin/templates">ひな形</a><a href="/admin/blackouts">受付不可</a><a href="/admin/settings">全体設定</a><a href="/admin/devices">受付端末</a><a href="/admin/logs">操作ログ</a><form class="inline" method="post" action="/admin/logout"><button>ログアウト</button></form></header>`
        : ''
  // F-05: any kiosk page other than the top returns to /kiosk after inactivity.
  const reset = resetSeconds
    ? html`<script>(()=>{let t;const r=()=>{clearTimeout(t);t=setTimeout(()=>location.replace('/kiosk'),${resetSeconds}*1000)};addEventListener('pointerdown',r);addEventListener('keydown',r);r()})()</script>`
    : ''
  return html`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${mode === 'public' ? 'index' : 'noindex'}"><title>${title}</title><style>${raw(CSS)}</style></head>
<body class="${mode}">${nav}<main>${body}</main>${reset}</body></html>`
}

export const markClass = (mark: string) => (mark === '○' ? 'm-ok' : mark === '△' ? 'm-few' : 'm-ng')
