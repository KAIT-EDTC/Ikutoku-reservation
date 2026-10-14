package com.kaitedtc.ikutoku.kiosk.util

import org.junit.Assert.assertEquals
import org.junit.Test

class DatesTest {
    @Test
    fun short() {
        assertEquals("11/7(土)", Dates.short("2026-11-07"))
        assertEquals("11/8(日)", Dates.short("2026-11-08"))
    }

    @Test
    fun time() {
        assertEquals("10:00", Dates.time("10:00"))
        assertEquals("9:30", Dates.time("09:30"))
        assertEquals("0:30", Dates.time("00:30"))
    }
}
