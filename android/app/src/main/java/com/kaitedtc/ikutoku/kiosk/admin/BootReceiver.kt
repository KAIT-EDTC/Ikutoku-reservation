package com.kaitedtc.ikutoku.kiosk.admin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.kaitedtc.ikutoku.kiosk.MainActivity
import com.kaitedtc.ikutoku.kiosk.store.DeviceStore

/**
 * 電源を入れたら、キオスクにしてあればこのアプリを開く（開いた画面がロックタスクに入り直す）。
 * SUNMI の ROM はホームアプリを自社のランチャーに固定するため、ホームアプリの指定だけでは起動しない。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!DeviceStore(context).kioskMode) return
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
