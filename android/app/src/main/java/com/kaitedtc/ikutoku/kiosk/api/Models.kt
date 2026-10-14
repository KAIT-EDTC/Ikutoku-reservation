package com.kaitedtc.ikutoku.kiosk.api

import kotlinx.serialization.Serializable

/** GET /api/kiosk（server/src/features/kiosk/routes.ts） */
@Serializable
data class KioskData(
    val notice: String = "",
    val maxPeople: Int,
    val resetSeconds: Int,
    val dates: List<String>,
    val slots: List<Slot> = emptyList(),
)

/** status は shared/src/slots.ts の SlotStatus（ok / few / full / stopped / ended） */
@Serializable
data class Slot(
    val id: Int,
    val date: String,
    val startTime: String,
    val endTime: String,
    val status: String,
    val remaining: Int,
    val bookable: Boolean,
)

@Serializable
data class ReserveRequest(val slotId: Int, val people: Int)

/** POST /api/kiosk/reservations の 201 */
@Serializable
data class Reservation(
    val code: String,
    val people: Int,
    val date: String,
    val startTime: String,
    val endTime: String,
)

@Serializable
data class LoginRequest(val code: String)

@Serializable
data class DeviceNameRequest(val name: String)

@Serializable
data class ErrorBody(val error: String = "")
