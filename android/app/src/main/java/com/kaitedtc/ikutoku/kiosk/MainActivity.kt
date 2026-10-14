package com.kaitedtc.ikutoku.kiosk

import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.kaitedtc.ikutoku.kiosk.admin.KioskPolicy
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskApp
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskControls
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskViewModel
import com.kaitedtc.ikutoku.kiosk.ui.theme.KioskTheme

/** 全画面・常時点灯・縦固定（Manifest）・戻るキー無効・キオスク（ロックタスク）。docs/sunmi-v1s.md 4-4 */
class MainActivity : ComponentActivity(), KioskControls {
    private val vm: KioskViewModel by viewModels()
    private val policy by lazy { KioskPolicy(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // 「もどる」は画面の中のボタンだけにする
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {}
        })
        // キーボードを閉じたあとなどにバーが出たままになるので、出たら少し待って隠し直す
        @Suppress("DEPRECATION")
        window.decorView.setOnSystemUiVisibilityChangeListener { flags ->
            if (flags and View.SYSTEM_UI_FLAG_HIDE_NAVIGATION == 0) window.decorView.postDelayed(::hideSystemBars, 2000)
        }
        setContent {
            KioskTheme { KioskApp(vm, this) }
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        // 再起動後もキオスクを続ける
        if (vm.store.kioskMode && policy.isDeviceOwner && !policy.isLocked) policy.start(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // 端からのスワイプで一瞬出たバーを、フォーカスが戻るたびに隠し直す
        if (hasFocus) hideSystemBars()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) vm.touched()
        return super.dispatchTouchEvent(ev)
    }

    private fun hideSystemBars() {
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    // ---- KioskControls（係員メニューから） --------------------------------

    override val isDeviceOwner get() = policy.isDeviceOwner
    override val isLocked get() = policy.isLocked

    override fun startKiosk(): Boolean = policy.start(this).also { if (it) vm.store.kioskMode = true }

    override fun stopKiosk() {
        vm.store.kioskMode = false
        policy.stop(this)
    }

    override fun releaseDeviceOwner() {
        vm.store.kioskMode = false
        policy.releaseDeviceOwner(this)
    }
}
