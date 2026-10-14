package com.kaitedtc.ikutoku.kiosk.printer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.core.content.res.ResourcesCompat
import com.kaitedtc.ikutoku.kiosk.R
import com.kaitedtc.ikutoku.kiosk.api.Reservation
import com.kaitedtc.ikutoku.kiosk.util.Dates

/** 予約券1枚の中身 */
data class Receipt(
    val title: String,
    val code: String,
    val dateTime: String,
    val people: Int,
    val issued: String,
    val qrUrl: String,
) {
    companion object {
        fun of(r: Reservation, title: String, deviceName: String, serverUrl: String) = Receipt(
            title = title,
            code = r.code,
            dateTime = "${Dates.short(r.date)} ${Dates.time(r.startTime)}〜${Dates.time(r.endTime)}",
            people = r.people,
            issued = "発券 ${Dates.nowShort()}  $deviceName".trim(),
            // ログイン済みの係員のスマホで読むと予約照会が開く（client/app/routes/admin/today.tsx）
            qrUrl = "$serverUrl/admin?code=${r.code}",
        )

        fun sample(deviceName: String, title: String) = Receipt(
            title = title,
            code = "TEST",
            dateTime = "テスト印刷 ${Dates.nowShort()}",
            people = 1,
            issued = "発券 ${Dates.nowShort()}  $deviceName".trim(),
            qrUrl = "https://fes.kaitedtc.com/",
        )
    }
}

/**
 * レシートを幅 384px（58mm の1行）の画像に描く。印字フォントは中国語前提なので、
 * 日本語は端末のフォントで描いた画像を printBitmap で印刷する。QR はプリンタの printQRCode で入れるため、上下2枚に分ける。
 */
object ReceiptRenderer {
    const val WIDTH = 384
    private const val PAD = 8f

    // 画面と同じ UD ゴシック。読み込めなければ端末のフォント
    private var regular: Typeface = Typeface.DEFAULT
    private var bold: Typeface = Typeface.DEFAULT_BOLD

    fun useFonts(context: Context) {
        runCatching {
            regular = ResourcesCompat.getFont(context, R.font.biz_ud_gothic_regular) ?: regular
            bold = ResourcesCompat.getFont(context, R.font.biz_ud_gothic_bold) ?: bold
        }
    }

    /** QR より上: 団体名・予約番号・日時・人数 */
    fun renderTop(r: Receipt): Bitmap = draw { y0 ->
        var y = y0
        if (r.title.isNotEmpty()) y = center(r.title, 28f, bold = true, y = y)
        y = rule(y)
        y = center("予約番号", 26f, y = y)
        y = center(r.code, 120f, bold = true, y = y, letterSpacing = 0.1f)
        y = rule(y)
        y = row("日時", r.dateTime, y)
        y = row("人数", "${r.people}名", y)
        rule(y)
    }

    /** QR より下: 案内・発券時刻 */
    fun renderBottom(r: Receipt): Bitmap = draw { y0 ->
        var y = y0
        y = center("開始時刻に受付へ", 24f, y = y)
        y = center("この券をお持ちください", 24f, y = y)
        y += 8f
        center(r.issued, 20f, y = y)
    }

    private class Ctx(val canvas: Canvas) {
        fun paint(size: Float, bold: Boolean = false, spacing: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = size
            typeface = if (bold) this@ReceiptRenderer.bold else regular
            letterSpacing = spacing
        }

        fun center(text: String, size: Float, y: Float, bold: Boolean = false, letterSpacing: Float = 0f): Float {
            val p = paint(size, bold, letterSpacing).apply { textAlign = Paint.Align.CENTER }
            while (p.textSize > 14f && p.measureText(text) > WIDTH - PAD * 2) p.textSize -= 1f
            val fm = p.fontMetrics
            canvas.drawText(text, WIDTH / 2f, y - fm.ascent, p)
            return y + (fm.descent - fm.ascent) + 4f
        }

        fun row(label: String, value: String, y: Float): Float {
            val lp = paint(24f)
            val vp = paint(30f, bold = true)
            // 長い値は幅に収まるまで小さくする（58mm に 384 ドットしかない）
            while (vp.textSize > 16f && vp.measureText(value) > WIDTH - PAD * 2 - 72f) vp.textSize -= 1f
            val fm = vp.fontMetrics
            val base = y - fm.ascent
            canvas.drawText(label, PAD, base, lp)
            canvas.drawText(value, PAD + 72f, base, vp)
            return y + (fm.descent - fm.ascent) + 6f
        }

        fun rule(y: Float): Float {
            val p = paint(1f).apply { strokeWidth = 2f }
            canvas.drawLine(PAD, y + 8f, WIDTH - PAD, y + 8f, p)
            return y + 18f
        }
    }

    /** 十分な高さの白い画像に描いてから、使った高さで切り詰める */
    private fun draw(block: Ctx.(Float) -> Float): Bitmap {
        val tall = Bitmap.createBitmap(WIDTH, 800, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(tall).apply { drawColor(Color.WHITE) }
        val height = Ctx(canvas).block(4f).toInt().coerceIn(1, 800)
        val out = Bitmap.createBitmap(tall, 0, 0, WIDTH, height)
        if (out !== tall) tall.recycle()
        return out
    }
}
