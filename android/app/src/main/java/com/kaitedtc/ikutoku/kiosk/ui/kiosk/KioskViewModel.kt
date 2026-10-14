package com.kaitedtc.ikutoku.kiosk.ui.kiosk

import android.app.Application
import android.os.SystemClock
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kaitedtc.ikutoku.kiosk.api.ApiException
import com.kaitedtc.ikutoku.kiosk.api.KioskApi
import com.kaitedtc.ikutoku.kiosk.api.Reservation
import com.kaitedtc.ikutoku.kiosk.api.Slot
import com.kaitedtc.ikutoku.kiosk.api.userMessage
import com.kaitedtc.ikutoku.kiosk.printer.Receipt
import com.kaitedtc.ikutoku.kiosk.printer.SunmiPrinter
import com.kaitedtc.ikutoku.kiosk.sound.Sounds
import com.kaitedtc.ikutoku.kiosk.sound.Voice
import com.kaitedtc.ikutoku.kiosk.store.DeviceStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException

/** 受付の画面。待機 → 日付 → 時間 → 人数 → 確認 → 発券中 → 完了（docs/sunmi-v1s.md 4-5） */
sealed interface Step {
    data object Idle : Step
    data class Dates(val dates: List<String>) : Step
    data class Times(val date: String, val slots: List<Slot>) : Step
    data class People(val slot: Slot) : Step
    data class Confirm(val slot: Slot, val people: Int) : Step
    data object Issuing : Step
    data class Done(val reservation: Reservation, val printError: String?) : Step

    /** 満員・通信エラーなど。back があれば「もどる」でそこへ */
    data class Failure(val message: String, val back: (() -> Unit)? = null) : Step

    /** 係員をお呼びください（係員メニューに入るまで音を鳴らし続ける） */
    data class CallStaff(val reason: String) : Step
    data object NotRegistered : Step
}

class KioskViewModel(app: Application) : AndroidViewModel(app) {
    val store = DeviceStore(app)
    val api = KioskApi({ store.serverUrl }, { store.token })
    val printer = SunmiPrinter(app).also { it.connect() }
    val sounds = Sounds(app).also { it.setVolume(store.volume) }
    val voice = Voice(app).also { it.enabled = store.voiceGuide }

    var step by mutableStateOf<Step>(if (store.registered) Step.Idle else Step.NotRegistered)
        private set
    var loading by mutableStateOf(false)
        private set
    var notice by mutableStateOf("")
        private set
    var maxPeople by mutableStateOf(1)
        private set

    /** 無操作で待機へ戻るまでの秒数（サーバーの全体設定） */
    var resetSeconds by mutableStateOf(60)
        private set

    /** 待機に戻るまでの残り秒数（待機・発券中などでは null） */
    var secondsLeft by mutableStateOf<Int?>(null)
        private set

    /** 係員メニューを開いているか */
    var staffOpen by mutableStateOf(false)
        private set

    /** 待機画面の空き状況ボード（発車標風）。読めなければ null で、ボードを出さない */
    var board by mutableStateOf<Board?>(null)
        private set

    data class Board(val date: String, val slots: List<Slot>)

    private var lastTouch = SystemClock.elapsedRealtime()
    private var alarm: Job? = null
    private var boardJob: Job? = null

    init {
        viewModelScope.launch {
            while (isActive) {
                tick()
                delay(500)
            }
        }
        refreshBoard()
    }

    /** 待機中は1分ごとに空き状況を読み直す */
    private fun refreshBoard() {
        boardJob?.cancel()
        boardJob = viewModelScope.launch {
            while (isActive) {
                if (step is Step.Idle && !staffOpen && store.registered) {
                    board = try {
                        val data = api.load()
                        notice = data.notice
                        maxPeople = data.maxPeople
                        resetSeconds = data.resetSeconds.coerceAtLeast(15)
                        data.dates.firstOrNull()?.let { d -> Board(d, api.load(d).slots) }
                    } catch (e: Exception) {
                        if (e is ApiException && e.status == 401) unregistered()
                        null
                    }
                }
                delay(60_000)
            }
        }
    }

    /** 画面のどこかに触れた */
    fun touched() {
        lastTouch = SystemClock.elapsedRealtime()
    }

    private fun tick() {
        val timed = when (step) {
            is Step.Dates, is Step.Times, is Step.People, is Step.Confirm, is Step.Done, is Step.Failure -> true
            else -> false
        }
        if (!timed || staffOpen || loading) {
            secondsLeft = null
            return
        }
        val left = resetSeconds - ((SystemClock.elapsedRealtime() - lastTouch) / 1000).toInt()
        if (left <= 0) reset() else secondsLeft = left
    }

    /** 取消・タイムアウト: 待機へ */
    fun reset() {
        stopAlarm()
        voice.stop()
        loading = false
        val wasIdle = step is Step.Idle
        step = if (store.registered) Step.Idle else Step.NotRegistered
        if (!wasIdle) refreshBoard()
    }

    // ---- 画面の操作 --------------------------------------------------------

    fun start() {
        sounds.beep()
        load { data ->
            if (data.dates.isEmpty()) {
                fail("ただいま予約を受け付けている日はありません。")
            } else {
                step = Step.Dates(data.dates)
            }
        }
    }

    fun pickDate(date: String) {
        sounds.beep()
        load(date) { data -> step = Step.Times(date, data.slots) }
    }

    fun pickSlot(slot: Slot) {
        sounds.beep()
        step = Step.People(slot)
    }

    fun pickPeople(slot: Slot, people: Int) {
        sounds.beep()
        step = Step.Confirm(slot, people)
    }

    fun back() {
        sounds.beep()
        when (val s = step) {
            is Step.Times -> load { step = Step.Dates(it.dates) }
            is Step.People -> load(s.slot.date) { step = Step.Times(s.slot.date, it.slots) }
            is Step.Confirm -> step = Step.People(s.slot)
            is Step.Failure -> s.back?.invoke() ?: reset()
            else -> reset()
        }
    }

    fun callStaff(reason: String = "まもなく係員がまいります") {
        sounds.beep()
        step = Step.CallStaff(reason)
        startAlarm { sounds.chime() }
    }

    /** 確定: プリンタを確かめてから予約し、予約券を印刷する */
    fun confirm() {
        val c = step as? Step.Confirm ?: return
        sounds.beep()
        if (store.requirePrinter) {
            val state = printer.state()
            if (state != SunmiPrinter.READY) {
                // 印刷できないなら予約しない（番号を渡せないため）
                step = Step.CallStaff("係員をお呼びください（${SunmiPrinter.stateMessage(state)}）")
                startAlarm { sounds.buzzer() }
                return
            }
        }
        step = Step.Issuing
        viewModelScope.launch {
            val started = SystemClock.elapsedRealtime()
            val r = try {
                api.reserve(c.slot.id, c.people)
            } catch (e: ApiException) {
                when (e.status) {
                    401 -> unregistered()
                    409 -> fail(e.userMessage()) { reloadTimes(c.slot.date) }
                    else -> fail(e.userMessage()) { step = Step.People(c.slot) }
                }
                return@launch
            } catch (e: IOException) {
                // 送ったあとで切れた: 予約できたか分からない
                step = Step.CallStaff("予約できたか確認できませんでした。係員にお知らせください。")
                startAlarm { sounds.buzzer() }
                return@launch
            }
            val error = printReceipt(r)
            // 「発券中」のアニメーションが一瞬で消えないよう、最低1.5秒は見せる
            delay((1500 - (SystemClock.elapsedRealtime() - started)).coerceAtLeast(0))
            touched()
            step = Step.Done(r, error)
            if (error == null) startAlarm(times = 3) { sounds.chime() } else sounds.buzzer()
        }
    }

    fun reprint() {
        val d = step as? Step.Done ?: return
        sounds.beep()
        viewModelScope.launch {
            step = d.copy(printError = printReceipt(d.reservation))
        }
    }

    private suspend fun printReceipt(r: Reservation): String? {
        val receipt = Receipt.of(r, store.receiptTitle, store.deviceName, store.serverUrl)
        val error = printer.print(receipt)
        // プリンタなしで試しているときは、印刷できなくてもエラーにしない
        return if (!store.requirePrinter && printer.state() != SunmiPrinter.READY) null else error
    }

    // ---- 係員メニュー ------------------------------------------------------

    fun openStaff() {
        stopAlarm()
        staffOpen = true
    }

    fun closeStaff() {
        staffOpen = false
        sounds.setVolume(store.volume)
        voice.enabled = store.voiceGuide
        touched()
        reset()
        refreshBoard()
    }

    // ---- 内部 --------------------------------------------------------------

    private fun reloadTimes(date: String) = load(date) { step = Step.Times(date, it.slots) }

    /** サーバーから受付の情報を読み、設定を更新してから next を呼ぶ */
    private fun load(date: String? = null, next: (com.kaitedtc.ikutoku.kiosk.api.KioskData) -> Unit) {
        if (loading) return
        loading = true
        viewModelScope.launch {
            try {
                val data = api.load(date)
                notice = data.notice
                maxPeople = data.maxPeople
                resetSeconds = data.resetSeconds.coerceAtLeast(15)
                touched()
                next(data)
            } catch (e: ApiException) {
                if (e.status == 401) unregistered() else fail(e.userMessage())
            } catch (e: IOException) {
                fail(e.userMessage())
            } finally {
                loading = false
            }
        }
    }

    private fun fail(message: String, back: (() -> Unit)? = null) {
        sounds.buzzer()
        touched()
        step = Step.Failure(message, back)
    }

    /** 管理画面で無効化された（または未登録）。トークンを捨てて係員メニューからの登録を待つ */
    private fun unregistered() {
        store.token = null
        step = Step.NotRegistered
        sounds.buzzer()
    }

    private fun startAlarm(times: Int = Int.MAX_VALUE, sound: () -> Unit) {
        stopAlarm()
        alarm = viewModelScope.launch {
            repeat(times) {
                sound()
                delay(2500)
            }
        }
    }

    private fun stopAlarm() {
        alarm?.cancel()
        alarm = null
    }

    override fun onCleared() {
        printer.disconnect()
        sounds.release()
        voice.release()
    }
}
