package com.kaitedtc.ikutoku.kiosk.sound

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * 音声案内（端末の音声合成）。日本語の音声合成が入っていない端末では何もしない。
 * 実在の券売機の音声は使わない（docs/sunmi-v1s.md 4-5）。
 */
class Voice(context: Context) : TextToSpeech.OnInitListener {
    private val tts = TextToSpeech(context.applicationContext, this)

    @Volatile
    var available = false
        private set

    var enabled = true

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        val r = tts.setLanguage(Locale.JAPAN)
        available = r == TextToSpeech.LANG_AVAILABLE || r == TextToSpeech.LANG_COUNTRY_AVAILABLE || r == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE
        tts.setSpeechRate(1.05f)
    }

    fun say(text: String) {
        if (available && enabled && text.isNotBlank()) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "guide")
    }

    fun stop() {
        if (available) tts.stop()
    }

    fun release() = tts.shutdown()
}
