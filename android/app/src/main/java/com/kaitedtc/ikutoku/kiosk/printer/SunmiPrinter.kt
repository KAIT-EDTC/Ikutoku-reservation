package com.kaitedtc.ikutoku.kiosk.printer

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.kaitedtc.ikutoku.kiosk.BuildConfig
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import kotlin.coroutines.resume

/**
 * SUNMI 内蔵プリンタ（端末内の印刷サービス woyou.aidlservice.jiuiv5 に bind して使う）。画面には依存しない。
 * SUNMI 以外の端末では bind できず、状態は NO_SERVICE になる。
 */
class SunmiPrinter(private val context: Context) {
    @Volatile private var service: SunmiPrinterService? = null

    private val connection = object : InnerPrinterCallback() {
        override fun onConnected(s: SunmiPrinterService) {
            service = s
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun connect() {
        ReceiptRenderer.useFonts(context)
        try {
            InnerPrinterManager.getInstance().bindService(context, connection)
        } catch (e: Exception) {
            Log.e(TAG, "印刷サービスに接続できません", e)
        }
    }

    fun disconnect() {
        runCatching { InnerPrinterManager.getInstance().unBindService(context, connection) }
        service = null
    }

    /** updatePrinterState() の値（公式デモ）。印刷サービスに繋がっていなければ NO_SERVICE */
    fun state(): Int = service?.let { runCatching { it.updatePrinterState() }.getOrDefault(NO_SERVICE) } ?: NO_SERVICE

    /** 予約券を1枚印刷する（まとめて送り、結果を待つ）。成功したら null、失敗したら理由 */
    suspend fun print(receipt: Receipt): String? = withContext(Dispatchers.IO) {
        if (BuildConfig.DEBUG) {
            ReceiptRenderer.renderTop(receipt).also { savePreview("top", it) }.recycle()
            ReceiptRenderer.renderBottom(receipt).also { savePreview("bottom", it) }.recycle()
        }
        val s = service ?: return@withContext stateMessage(NO_SERVICE)
        val st = state()
        if (st != READY) return@withContext stateMessage(st)

        val top = ReceiptRenderer.renderTop(receipt)
        val bottom = ReceiptRenderer.renderBottom(receipt)
        // 成功は OK（""）で受け取る。null は「20秒で結果が返らなかった」にだけ使う
        val result = withTimeoutOrNull(20_000) {
            suspendCancellableCoroutine<String> { cont ->
                try {
                    s.enterPrinterBuffer(true)
                    s.printerInit(ack())
                    s.setAlignment(1, ack()) // 中央
                    s.printBitmap(top, ack())
                    s.lineWrap(1, ack())
                    s.printQRCode(receipt.qrUrl, 6, 1, ack()) // モジュール6ドット・誤り訂正 M
                    s.lineWrap(1, ack())
                    s.printBitmap(bottom, ack())
                    s.lineWrap(4, ack()) // カッターがないので手で切れる位置まで送る
                    s.exitPrinterBufferWithCallback(true, object : InnerResultCallback() {
                        override fun onRunResult(isSuccess: Boolean) {}
                        override fun onReturnString(result: String?) {}
                        override fun onRaiseException(code: Int, msg: String?) {
                            Log.e(TAG, "印刷の例外 $code $msg")
                            if (cont.isActive) cont.resume("印刷できませんでした（$code ${msg.orEmpty()}）")
                        }

                        override fun onPrintResult(code: Int, msg: String?) {
                            if (code != 0) Log.e(TAG, "印刷の結果 $code $msg")
                            if (cont.isActive) cont.resume(if (code == 0) OK else "印刷できませんでした（$code ${msg.orEmpty()}）")
                        }
                    })
                } catch (e: Exception) {
                    Log.e(TAG, "印刷に失敗", e)
                    if (cont.isActive) cont.resume("印刷できませんでした（${e.message}）")
                }
            }
        } ?: "印刷が終わりませんでした".also { Log.e(TAG, "印刷の結果が20秒以内に返りませんでした") }
        top.recycle()
        bottom.recycle()
        result.takeIf { it != OK }
    }

    /** 各命令に渡す受け取り口（命令ごとの例外をログに残す） */
    private fun ack() = object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {}
        override fun onReturnString(result: String?) {}
        override fun onRaiseException(code: Int, msg: String?) { Log.e(TAG, "印刷命令の例外 $code $msg") }
        override fun onPrintResult(code: Int, msg: String?) {}
    }

    /** テスト印刷（係員メニュー） */
    suspend fun printTest(deviceName: String, title: String): String? = print(Receipt.sample(deviceName, title))

    /** debug ビルドでは、印刷する画像を cache/receipt-*.png にも残す（プリンタの無い端末でも見た目を確かめられる） */
    private fun savePreview(name: String, bmp: Bitmap) {
        runCatching { File(context.cacheDir, "receipt-$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }

    companion object {
        private const val TAG = "SunmiPrinter"
        const val READY = 1
        const val NO_SERVICE = -1
        private const val OK = ""

        fun stateMessage(state: Int): String = when (state) {
            READY -> "正常"
            2 -> "プリンタの準備中です"
            3 -> "プリンタが故障しています"
            4 -> "用紙が切れています"
            5 -> "プリンタが熱くなっています"
            6 -> "プリンタのカバーが開いています"
            7 -> "カッターの異常です"
            505 -> "プリンタがありません"
            NO_SERVICE -> "プリンタに接続できません"
            else -> "プリンタの異常です（$state）"
        }
    }
}
