package com.kaitedtc.ikutoku.kiosk.sound

import android.content.Context
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sign
import kotlin.math.sin

/**
 * 操作音。音源ファイルを持たず、起動時に波形を作って AudioTrack（static）に入れておく（鳴らすときの遅れが少ない）。
 * 実在の券売機の音は使わない（docs/sunmi-v1s.md 4-5）。
 */
class Sounds(context: Context) {
    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /** タッチ「ピッ」 */
    private val beep = track(tone(2000.0, 0.06))

    /** 案内「ピンポン」 */
    private val chime = track(tone(1318.5, 0.35, decay = 6.0) + tone(1046.5, 0.6, decay = 4.0))

    /** エラー「ブッブー」 */
    private val buzzer = track(tone(220.0, 0.18, square = true) + silence(0.08) + tone(220.0, 0.45, square = true))

    fun beep() = play(beep)
    fun chime() = play(chime)
    fun buzzer() = play(buzzer)

    /** メディア音量を 0〜100 の割合で合わせる */
    fun setVolume(percent: Int) {
        val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, (max * percent / 100f).toInt(), 0)
    }

    fun release() = listOf(beep, chime, buzzer).forEach { it?.release() }

    private fun play(t: AudioTrack?) {
        t ?: return
        runCatching {
            t.stop()
            t.reloadStaticData()
            t.play()
        }
    }

    private fun track(samples: ShortArray): AudioTrack? = runCatching {
        @Suppress("DEPRECATION")
        AudioTrack(
            AudioManager.STREAM_MUSIC, RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
            samples.size * 2, AudioTrack.MODE_STATIC,
        ).apply { write(samples, 0, samples.size) }
    }.getOrNull()

    private fun tone(freq: Double, seconds: Double, decay: Double = 0.0, square: Boolean = false): ShortArray {
        val n = (RATE * seconds).toInt()
        val fade = (RATE * 0.005).toInt() // ぷつっと鳴らないよう前後5msをなめらかに
        return ShortArray(n) { i ->
            val t = i.toDouble() / RATE
            var v = sin(2 * PI * freq * t)
            if (square) v = v.sign * 0.6
            v *= exp(-decay * t)
            v *= minOf(1.0, i / fade.toDouble(), (n - i) / fade.toDouble())
            (v * 0.8 * Short.MAX_VALUE).toInt().toShort()
        }
    }

    private fun silence(seconds: Double) = ShortArray((RATE * seconds).toInt())

    companion object {
        private const val RATE = 22050
    }
}
