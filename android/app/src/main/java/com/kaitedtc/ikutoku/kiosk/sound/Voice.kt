package com.kaitedtc.ikutoku.kiosk.sound

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioManager
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * 音声案内。録音した声（res/raw/v_*.wav。android/tools/voice/ で作る）があればそれを流し、
 * なければ端末の音声合成（日本語があるときだけ）で読む。実在の券売機の音声は使わない（docs/sunmi-v1s.md 4-5）。
 */
class Voice(context: Context) : TextToSpeech.OnInitListener {
    private val app = context.applicationContext
    private val tts = TextToSpeech(app, this)
    private var player: MediaPlayer? = null
    private var pending: (() -> Unit)? = null

    /** 日本語の音声合成が使えるか（録音した声は、これに関係なく流れる） */
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

    /**
     * 録音した声 name を流す。無ければ fallback を音声合成で読む（空なら何もしない）。
     * after = true なら、いま流れている声が終わってから流す（「発券しています」→「予約券をお取りください」）
     */
    fun play(name: String?, fallback: String = "", after: Boolean = false) {
        if (!enabled) return
        if (after && player?.isPlaying == true) {
            pending = { play(name, fallback) }
            return
        }
        stop()
        val id = name?.let { raw(it) } ?: 0
        if (id != 0) {
            player = MediaPlayer.create(app, id)?.apply {
                @Suppress("DEPRECATION")
                setAudioStreamType(AudioManager.STREAM_MUSIC)
                setOnCompletionListener {
                    it.release()
                    if (player === it) player = null
                    pending?.also { pending = null }?.invoke()
                }
                start()
            }
        } else if (available && fallback.isNotBlank()) {
            tts.speak(fallback, TextToSpeech.QUEUE_FLUSH, null, "guide")
        }
    }

    /** 音声合成で読む（係員メニューの試し用） */
    fun say(text: String) = play(null, text)

    fun stop() {
        pending = null
        player?.runCatching { stop(); release() }
        player = null
        if (available) tts.stop()
    }

    fun release() {
        stop()
        tts.shutdown()
    }

    // ファイルが無くてもビルドできるよう、名前で探す
    @SuppressLint("DiscouragedApi")
    private fun raw(name: String) = app.resources.getIdentifier(name, "raw", app.packageName)
}
