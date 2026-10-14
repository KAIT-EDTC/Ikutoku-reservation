package com.kaitedtc.ikutoku.kiosk.admin

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.kaitedtc.ikutoku.kiosk.MainActivity

/**
 * キオスク化（docs/sunmi-v1s.md 4-4）。デバイス所有者のときだけ使える:
 * ロックタスク（ホーム・タスク一覧が消え、他のアプリを開けない）＋ステータスバー無効＋画面ロック無効＋ホームアプリ固定。
 */
class KioskPolicy(private val context: Context) {
    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val admin = ComponentName(context, KioskAdminReceiver::class.java)

    val isDeviceOwner: Boolean get() = dpm.isDeviceOwnerApp(context.packageName)

    val isLocked: Boolean
        get() {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            return am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        }

    /** キオスク開始。デバイス所有者でなければ false（画面固定の確認が出る通常のピン留めにはしない） */
    fun start(activity: Activity): Boolean {
        if (!isDeviceOwner) return false
        dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
        dpm.setStatusBarDisabled(admin, true)
        dpm.setKeyguardDisabled(admin, true)
        val home = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        dpm.addPersistentPreferredActivity(admin, home, ComponentName(context, MainActivity::class.java))
        activity.startLockTask()
        return true
    }

    /** キオスク解除（係員メニュー）。デバイス所有者のままにする */
    fun stop(activity: Activity) {
        runCatching { activity.stopLockTask() }
        if (!isDeviceOwner) return
        dpm.setStatusBarDisabled(admin, false)
        dpm.setKeyguardDisabled(admin, false)
        dpm.clearPackagePersistentPreferredActivities(admin, context.packageName)
    }

    /** デバイス所有者を外す。Android 6 ではこれが無いと初期化しないと外せない */
    @Suppress("DEPRECATION")
    fun releaseDeviceOwner(activity: Activity) {
        stop(activity)
        if (isDeviceOwner) dpm.clearDeviceOwnerApp(context.packageName)
    }
}
