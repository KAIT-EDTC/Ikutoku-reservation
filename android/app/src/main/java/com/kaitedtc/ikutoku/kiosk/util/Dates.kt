package com.kaitedtc.ikutoku.kiosk.util

import java.util.Calendar
import java.util.TimeZone

/** サーバーの日付・時刻は日本時間の文字列（'YYYY-MM-DD' / 'HH:MM'）。java.time は Android 8 からなので Calendar を使う */
object Dates {
    private val JST: TimeZone = TimeZone.getTimeZone("Asia/Tokyo")
    private val WEEKDAYS = arrayOf("日", "月", "火", "水", "木", "金", "土")

    /** '2026-11-07' → 曜日（0 = 日） */
    fun weekday(date: String): Int {
        val (y, m, d) = date.split("-").map { it.toInt() }
        return Calendar.getInstance(JST).apply { clear(); set(y, m - 1, d) }.get(Calendar.DAY_OF_WEEK) - 1
    }

    /** '2026-11-07' → '11/7(土)' */
    fun short(date: String): String {
        val (_, m, d) = date.split("-").map { it.toInt() }
        return "$m/$d(${WEEKDAYS[weekday(date)]})"
    }

    /** '2026-11-07' → '11月7日'（日付ボタン用） */
    fun monthDay(date: String): String {
        val (_, m, d) = date.split("-").map { it.toInt() }
        return "${m}月${d}日"
    }

    fun weekdayLong(date: String) = WEEKDAYS[weekday(date)] + "曜日"

    /** '10:00' → '10:00'、'09:30' → '9:30' */
    fun time(t: String) = t.trimStart('0').let { if (it.startsWith(":")) "0$it" else it }

    /** 今（日本時間）を 'M/D H:MM' で（レシートの発券時刻） */
    fun nowShort(): String {
        val c = Calendar.getInstance(JST)
        return "${c.get(Calendar.MONTH) + 1}/${c.get(Calendar.DAY_OF_MONTH)} ${c.get(Calendar.HOUR_OF_DAY)}:%02d".format(c.get(Calendar.MINUTE))
    }

    /** その月の日数と、1日の曜日（0 = 日）。カレンダー用 */
    fun monthLayout(year: Int, month: Int): Pair<Int, Int> {
        val c = Calendar.getInstance(JST).apply { clear(); set(year, month - 1, 1) }
        return c.getActualMaximum(Calendar.DAY_OF_MONTH) to c.get(Calendar.DAY_OF_WEEK) - 1
    }

    /** 今日（日本時間）を 'YYYY-MM-DD' */
    fun today(): String {
        val c = Calendar.getInstance(JST)
        return "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
    }

    /** 今（日本時間）を 'H:MM'（待機画面の時計） */
    fun clock(): String {
        val c = Calendar.getInstance(JST)
        return "${c.get(Calendar.HOUR_OF_DAY)}:%02d".format(c.get(Calendar.MINUTE))
    }
}
