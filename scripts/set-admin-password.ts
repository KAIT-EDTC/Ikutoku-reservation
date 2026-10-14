// Usage: npm run set-password -- [--remote]   (login ID is always "admin", a role name — spec §7)
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { hashPassword } from '../src/lib.ts'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const pw = await rl.question('admin の新しいパスワード（8文字以上）: ')
rl.close()
if (pw.length < 8) throw new Error('8文字以上にしてください')
const sql = `INSERT INTO admins (login_id, password_hash) VALUES ('admin', '${await hashPassword(pw)}')
  ON CONFLICT (login_id) DO UPDATE SET password_hash = excluded.password_hash`
execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', process.argv.includes('--remote') ? '--remote' : '--local', '--command', sql], { stdio: 'inherit' })
