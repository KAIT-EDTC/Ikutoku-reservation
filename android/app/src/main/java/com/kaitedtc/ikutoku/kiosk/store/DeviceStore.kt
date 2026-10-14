package com.kaitedtc.ikutoku.kiosk.store

import android.content.Context
import androidx.core.content.edit

/** 端末に残す設定（SharedPreferences）。予約の中身や個人情報は保存しない */
class DeviceStore(context: Context) {
    private val prefs = context.getSharedPreferences("device", Context.MODE_PRIVATE)

    /** 予約システムの URL（末尾の / なし） */
    var serverUrl: String
        get() = prefs.getString(KEY_SERVER, DEFAULT_SERVER)!!
        set(v) = prefs.edit { putString(KEY_SERVER, v.trim().trimEnd('/')) }

    /** Cookie `dev` の中身。管理画面で無効化されると 401 になる */
    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(v) = prefs.edit { putString(KEY_TOKEN, v) }

    /** 管理画面の「受付端末」に出る名前。レシートにも印字する */
    var deviceName: String
        get() = prefs.getString(KEY_NAME, "")!!
        set(v) = prefs.edit { putString(KEY_NAME, v) }

    /** 係員メニューの暗証番号。空なら未設定（最初の1回だけ番号なしで入れる） */
    var staffPin: String
        get() = prefs.getString(KEY_PIN, "")!!
        set(v) = prefs.edit { putString(KEY_PIN, v) }

    /** レシートの一番上の行（団体名・企画名） */
    var receiptTitle: String
        get() = prefs.getString(KEY_TITLE, "")!!
        set(v) = prefs.edit { putString(KEY_TITLE, v.trim()) }

    /** 音量（0〜100）。起動時にメディア音量をこの値に合わせる */
    var volume: Int
        get() = prefs.getInt(KEY_VOLUME, 70)
        set(v) = prefs.edit { putInt(KEY_VOLUME, v.coerceIn(0, 100)) }

    /** false にすると、プリンタが無くても予約する（SUNMI 以外の端末で試すとき用） */
    var requirePrinter: Boolean
        get() = prefs.getBoolean(KEY_REQUIRE_PRINTER, true)
        set(v) = prefs.edit { putBoolean(KEY_REQUIRE_PRINTER, v) }

    /** キオスク（ロックタスク）にしておくか。再起動しても続ける */
    var kioskMode: Boolean
        get() = prefs.getBoolean(KEY_KIOSK, false)
        set(v) = prefs.edit { putBoolean(KEY_KIOSK, v) }

    /** 音声案内（端末に日本語の音声合成があるときだけ鳴る） */
    var voiceGuide: Boolean
        get() = prefs.getBoolean(KEY_VOICE, true)
        set(v) = prefs.edit { putBoolean(KEY_VOICE, v) }

    val registered: Boolean get() = !token.isNullOrEmpty()

    companion object {
        const val DEFAULT_SERVER = "https://fes.kaitedtc.com"
        private const val KEY_SERVER = "server_url"
        private const val KEY_TOKEN = "device_token"
        private const val KEY_NAME = "device_name"
        private const val KEY_PIN = "staff_pin"
        private const val KEY_TITLE = "receipt_title"
        private const val KEY_VOLUME = "volume"
        private const val KEY_REQUIRE_PRINTER = "require_printer"
        private const val KEY_KIOSK = "kiosk_mode"
        private const val KEY_VOICE = "voice_guide"
    }
}
