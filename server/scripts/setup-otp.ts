// 使い方: npm run setup-otp [-- --remote | --preview]
// 共有の管理者アカウント(admin)に新しいTOTPの秘密鍵を発行し、認証アプリで読み取るQRを表示する。
// 古いコードは使えなくなり、管理画面のセッションはすべてログアウトされる。
// --preview はPRプレビュー用。D1には書かずに表示だけする。手入力用キーを GitHub の preview environment の
// secret PREVIEW_TOTP_SECRET に登録すると、.github/workflows/preview.yml がデプロイのたびに管理者を入れる。
import { execFileSync } from 'node:child_process'
import { renderUnicodeCompact } from 'uqr'
import { newTotpSecret, otpauthUri } from '../src/lib/crypto.ts'

const remote = process.argv.includes('--remote')
const preview = process.argv.includes('--preview')
const secret = newTotpSecret()
const sql = `INSERT INTO admins (login_id, totp_secret) VALUES ('admin', '${secret}')
  ON CONFLICT (login_id) DO UPDATE SET totp_secret = excluded.totp_secret, totp_last_step = 0`
if (!preview) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'ikutoku-reservation', ...(remote ? ['--remote', '--env', 'production'] : ['--local']), '--command', sql], {
    stdio: ['inherit', 'ignore', 'inherit'],
  })
}
console.log(`\n${renderUnicodeCompact(otpauthUri(secret, { env: preview ? 'preview' : remote ? undefined : 'dev' }))}\n手入力用キー: ${secret}\n`)
