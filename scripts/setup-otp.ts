// Usage: npm run setup-otp -- [--remote]
// Issues a new TOTP secret for the shared "admin" account and prints a QR to scan with an authenticator app.
// Old codes stop working and all admin sessions are logged out.
import { execFileSync } from 'node:child_process'
import { renderUnicodeCompact } from 'uqr'
import { newTotpSecret, otpauthUri } from '../server/auth.ts'

const secret = newTotpSecret()
const sql = `INSERT INTO admins (login_id, totp_secret) VALUES ('admin', '${secret}')
  ON CONFLICT (login_id) DO UPDATE SET totp_secret = excluded.totp_secret, totp_last_step = 0`
execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', process.argv.includes('--remote') ? '--remote' : '--local', '--command', sql], { stdio: ['inherit', 'ignore', 'inherit'] })
console.log(`\n${renderUnicodeCompact(otpauthUri(secret))}\n手入力用キー: ${secret}\n`)
