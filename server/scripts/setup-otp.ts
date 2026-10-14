// 使い方: npm run setup-otp [-- --remote]
// 共有の管理者アカウント(admin)に新しいTOTPの秘密鍵を発行し、認証アプリで読み取るQRを表示する。
// 古いコードは使えなくなり、管理画面のセッションはすべてログアウトされる。
import { execFileSync } from 'node:child_process'
import { renderUnicodeCompact } from 'uqr'
import { newTotpSecret, otpauthUri } from '../src/lib/crypto.ts'

const remote = process.argv.includes('--remote')
const secret = newTotpSecret()
const sql = `INSERT INTO admins (login_id, totp_secret) VALUES ('admin', '${secret}')
  ON CONFLICT (login_id) DO UPDATE SET totp_secret = excluded.totp_secret, totp_last_step = 0`
execFileSync('npx', ['wrangler', 'd1', 'execute', 'ikutoku-reservation', ...(remote ? ['--remote', '--env', 'production'] : ['--local']), '--command', sql], {
  stdio: ['inherit', 'ignore', 'inherit'],
})
console.log(`\n${renderUnicodeCompact(otpauthUri(secret))}\n手入力用キー: ${secret}\n`)
