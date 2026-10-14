import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newTotpSecret, totp, verifyTotp } from '../src/lib/crypto.ts'

test('totp (RFC 6238 appendix B, last 6 digits)', async () => {
  const rfc = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // ASCII "12345678901234567890"
  assert.equal(await totp(rfc, Math.floor(59 / 30)), '287082')
  assert.equal(await totp(rfc, Math.floor(1111111109 / 30)), '081804')
  assert.equal(await totp(rfc, Math.floor(20000000000 / 30)), '353130')
  assert.equal(await verifyTotp(rfc, '081804', 1111111109_000 + 30_000), Math.floor(1111111109 / 30)) // 1つ前のステップも受け付ける
  assert.equal(await verifyTotp(rfc, '081804', 1111111109_000 + 90_000), null)
  assert.match(newTotpSecret(), /^[A-Z2-7]{32}$/)
})
