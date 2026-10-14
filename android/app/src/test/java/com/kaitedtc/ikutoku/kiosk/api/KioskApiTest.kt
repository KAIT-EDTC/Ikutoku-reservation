package com.kaitedtc.ikutoku.kiosk.api

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.nio.ByteBuffer
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * ローカルの wrangler dev に対して、アプリと同じ通信（端末登録 → 受付データ → 予約）を通す。
 * 準備: npm run db:migrate && npm run db:seed && npm run setup-otp（表示された手入力用キーを使う）→ npm run dev -w server
 * 実行: KIOSK_TEST_SERVER=http://localhost:8787 KIOSK_TEST_OTP_SECRET=<キー> ./gradlew test
 */
class KioskApiTest {
    private val server = System.getenv("KIOSK_TEST_SERVER").orEmpty()
    private val secret = System.getenv("KIOSK_TEST_OTP_SECRET").orEmpty()

    @Test
    fun registerLoadAndReserve() = runTest {
        assumeTrue("KIOSK_TEST_SERVER が無いので省略", server.isNotEmpty() && secret.isNotEmpty())
        var token: String? = null
        val api = KioskApi({ server }, { token })

        // 未登録は 401
        try {
            api.load()
            fail("未登録なのに読めた")
        } catch (e: ApiException) {
            assertEquals(401, e.status)
        }

        token = api.register(totp(secret), "テスト端末")
        assertTrue(token.length >= 32)

        val data = api.load()
        assertTrue("日付がない: ${data.dates}", data.dates.isNotEmpty())
        val day = api.load(data.dates.first())
        val slot = day.slots.first { it.bookable }

        val r = api.reserve(slot.id, 1)
        assertEquals(4, r.code.length)
        assertEquals(slot.date, r.date)
        assertEquals(slot.startTime, r.startTime)

        // 残数より多い人数は 409（満員）か 400（最大人数超え）
        try {
            api.reserve(slot.id, slot.remaining + 100)
            fail("定員を超えて予約できた")
        } catch (e: ApiException) {
            assertTrue("status=${e.status}", e.status == 409 || e.status == 400)
            assertTrue(e.message!!.isNotBlank())
        }
    }

    /** RFC 6238（30秒・6桁・SHA-1）。server/src/lib/crypto.ts と同じ */
    private fun totp(base32: String): String {
        val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        var bits = 0
        var value = 0
        val key = mutableListOf<Byte>()
        for (c in base32.trim().uppercase()) {
            value = (value shl 5) or alphabet.indexOf(c)
            bits += 5
            if (bits >= 8) {
                key += (value shr (bits - 8) and 0xff).toByte()
                bits -= 8
            }
        }
        val mac = Mac.getInstance("HmacSHA1").apply { init(SecretKeySpec(key.toByteArray(), "HmacSHA1")) }
        val h = mac.doFinal(ByteBuffer.allocate(8).putLong(System.currentTimeMillis() / 30_000).array())
        val o = h.last().toInt() and 0xf
        val n = ByteBuffer.wrap(h, o, 4).int and 0x7fffffff
        return "%06d".format(n % 1_000_000)
    }
}
