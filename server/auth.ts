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
