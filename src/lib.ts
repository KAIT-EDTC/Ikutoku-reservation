// Pure logic shared by the worker and the tests (no Workers/Hono imports here).

export type Settings = { open_date: string; close_date: string; max_people: number; reset_seconds: number; notice: string }
export type Slot = { id: number; date: string; start_time: string; end_time: string; capacity: number; status: string; booked: number }
export type Rule = {
  id: number; kind: 'once' | 'weekly' | 'monthly' | 'slot'
  date_from: string | null; date_to: string | null; weekday: number | null; nth: number | null
  time_from: string | null; time_to: string | null; slot_id: number | null; memo: string
}
export type SlotState = { bookable: boolean; mark: '○' | '△' | '×' | '受付停止' | '終了'; remaining: number }

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// Current Asia/Tokyo time as { date: 'YYYY-MM-DD', time: 'HH:MM' }. JST has no DST.
export function nowJst(ms = Date.now()) {
  const iso = new Date(ms + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), iso: iso.slice(0, 19).replace('T', ' ') }
}

export const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

export function addDays(date: string, n: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)
}

export function datesBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 366; d = addDays(d, 1)) out.push(d)
  return out
}

export const fmtDate = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}(${WEEKDAYS[weekday(date)]})`

// Does a blackout rule cover this slot? A null time range means all day.
export function ruleBlocks(rule: Rule, slot: Pick<Slot, 'id' | 'date' | 'start_time' | 'end_time'>) {
  if (rule.kind === 'slot') return rule.slot_id === slot.id
  const d = slot.date
  if (rule.kind === 'once' && !(rule.date_from! <= d && d <= rule.date_to!)) return false
  if (rule.kind === 'weekly' && weekday(d) !== rule.weekday) return false
  if (rule.kind === 'monthly' && (weekday(d) !== rule.weekday || Math.ceil(+d.slice(8, 10) / 7) !== rule.nth)) return false
  if (rule.time_from && rule.time_to) return slot.start_time < rule.time_to && rule.time_from < slot.end_time
  return true
}

// Judging order follows the spec §6: blackout > period/past > capacity.
export function slotState(slot: Slot, rules: Rule[], s: Settings, now = nowJst()): SlotState {
  const remaining = Math.max(0, slot.capacity - slot.booked)
  if (slot.status !== 'open' || rules.some((r) => ruleBlocks(r, slot))) return { bookable: false, mark: '受付停止', remaining }
  if (slot.date < s.open_date || slot.date > s.close_date) return { bookable: false, mark: '受付停止', remaining }
  if (slot.date < now.date || (slot.date === now.date && slot.start_time <= now.time)) return { bookable: false, mark: '終了', remaining }
  if (remaining <= 0) return { bookable: false, mark: '×', remaining }
  return { bookable: true, mark: remaining <= Math.max(2, slot.capacity * 0.3) ? '△' : '○', remaining }
}

// No 0/O, 1/I/L to avoid misreading.
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function newCode(len = 4) {
  return [...crypto.getRandomValues(new Uint8Array(len))].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// --- crypto (WebCrypto only, so it also runs in Node for scripts/tests) ---
const enc = (s: string) => new TextEncoder().encode(s)
export const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)))
export const sha256 = async (s: string) => b64u(await crypto.subtle.digest('SHA-256', enc(s)))

export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// --- TOTP (RFC 6238: HMAC-SHA1, 30s, 6 digits) — what Google Authenticator etc. expect ---
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const TOTP_SECRET = /^[A-Z2-7]{32}$/
export const newTotpSecret = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => B32[b & 31]).join('') // 160 bits

function b32decode(s: string) {
  const out: number[] = []
  let val = 0, bits = 0
  for (const ch of s) {
    val = ((val << 5) | B32.indexOf(ch)) & 0xffff
    bits += 5
    if (bits >= 8) out.push((val >>> (bits -= 8)) & 255)
  }
  return new Uint8Array(out)
}

export async function totp(secret: string, step: number) {
  const key = await crypto.subtle.importKey('raw', b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new DataView(new ArrayBuffer(8))
  msg.setUint32(0, Math.floor(step / 2 ** 32))
  msg.setUint32(4, step >>> 0)
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg.buffer))
  const o = h[19] & 15
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0')
}

// Returns the matched time step (±1 step for clock drift), or null. Callers reject steps already used.
export async function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null
  const step = Math.floor(now / 30_000)
  for (const s of [step - 1, step, step + 1]) if (safeEqual(await totp(secret, s), code)) return s
  return null
}

export const otpauthUri = (secret: string) =>
  `otpauth://totp/Ikutoku-reservation:admin?secret=${secret}&issuer=Ikutoku-reservation`

export async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', enc(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', k, enc(msg)))
}
