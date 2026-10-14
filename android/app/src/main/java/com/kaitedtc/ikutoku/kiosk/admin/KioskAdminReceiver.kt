package com.kaitedtc.ikutoku.kiosk.admin

import android.app.admin.DeviceAdminReceiver

/**
 * デバイス所有者の受け口。PC から1回だけ設定する:
 * adb shell dpm set-device-owner com.kaitedtc.ikutoku.kiosk/.admin.KioskAdminReceiver
 */
class KioskAdminReceiver : DeviceAdminReceiver()
