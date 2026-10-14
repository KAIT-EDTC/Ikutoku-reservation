package com.kaitedtc.ikutoku.kiosk.ui.kiosk

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kaitedtc.ikutoku.kiosk.api.Slot
import com.kaitedtc.ikutoku.kiosk.ui.setup.PinPad
import com.kaitedtc.ikutoku.kiosk.ui.setup.SetupScreen
import com.kaitedtc.ikutoku.kiosk.ui.theme.Kiosk
import com.kaitedtc.ikutoku.kiosk.util.Dates
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull

/*
 * 画面の作りは指定席券売機（JR 東日本の公式「指定席券売機を体験する」の画面）にならう:
 * 黒い見出し帯（強調語は黄色）・灰色の地・濃い灰色のボタン・赤い丸の取消・橙の「前画面に戻る」・緑の確認。
 * ロゴ・アイコン・画像・音声は使わない。
 */

@Composable
fun KioskApp(vm: KioskViewModel, kiosk: KioskControls) {
    var askPin by remember { mutableStateOf(false) }
    val openStaff = {
        if (vm.store.staffPin.isEmpty()) vm.openStaff() else askPin = true
    }

    Box(Modifier.fillMaxSize().background(Kiosk.Body)) {
        when {
            vm.staffOpen -> SetupScreen(vm, kiosk, onClose = vm::closeStaff)
            askPin -> PinPad(
                expected = vm.store.staffPin,
                onCancel = { askPin = false },
                onOk = {
                    askPin = false
                    vm.openStaff()
                },
            )
            else -> {
                KioskFlow(vm)
                // 左上を3秒長押しで係員メニュー（お客さんには見えない）
                StaffCorner(Modifier.align(Alignment.TopStart), onLongPress = openStaff)
            }
        }
    }
}

/** 係員メニューの入口・キオスク操作。Activity が実装する */
interface KioskControls {
    val isDeviceOwner: Boolean
    val isLocked: Boolean
    fun startKiosk(): Boolean
    fun stopKiosk()
    fun releaseDeviceOwner()
}

@Composable
private fun StaffCorner(modifier: Modifier, onLongPress: () -> Unit) {
    Box(
        modifier
            .size(width = 96.dp, height = 40.dp)
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    val released = withTimeoutOrNull(3000) { waitForUpOrCancellation() }
                    if (released == null) onLongPress()
                }
            },
    )
}

// ---- 画面の流れ ------------------------------------------------------------

private fun Step.headline() = when (this) {
    is Step.Dates -> Headline("ご希望の", "日付", "をお選びください")
    is Step.Times -> Headline("ご希望の", "時間", "をお選びください", sub = "${Dates.short(date)}　開始時刻の早い順です")
    is Step.People -> Headline("", "ご利用人数", "をお選びください")
    is Step.Confirm -> Headline("よろしければ", "確認", "を押してください", green = true)
    is Step.Issuing -> Headline("", "予約券", "を発券しています", sub = "しばらくお待ちください")
    is Step.Done -> Headline("", "予約券", "をお取りください")
    is Step.Failure -> Headline("", "お手続き", "ができませんでした")
    is Step.CallStaff -> Headline("", "係員", "をお呼びしています")
    else -> Headline("", "", "")
}

/** 画面が変わったときの音声案内: 録音した声の名前（res/raw）と、無いときに音声合成で読む文 */
private fun Step.voice(): Pair<String?, String> = when (this) {
    is Step.Dates -> "v_date" to "ご希望の日付を、お選びください"
    is Step.Times -> "v_time" to "ご希望の時間を、お選びください"
    is Step.People -> "v_people" to "ご利用人数を、お選びください"
    is Step.Confirm -> "v_confirm" to "よろしければ、確認を、押してください"
    is Step.Done -> if (printError == null) "v_take_ticket" to "予約券を、お取りください" else null to "印刷できませんでした。この画面の予約番号を、係員にお見せください"
    is Step.Failure -> voice to message
    is Step.CallStaff -> voice to "係員をお呼びしています。そのままお待ちください"
    else -> null to ""
}

/** ここまでの入力内容（日付・時間・人数） */
private fun Step.entered(): Triple<String?, Slot?, Int?>? = when (this) {
    is Step.Times -> Triple(date, null, null)
    is Step.People -> Triple(slot.date, slot, null)
    is Step.Confirm -> Triple(slot.date, slot, people)
    else -> null
}

private fun Step.hasFooter() = this is Step.Dates || this is Step.Times || this is Step.People || this is Step.Confirm || this is Step.Failure

@Composable
private fun KioskFlow(vm: KioskViewModel) {
    val step = vm.step
    var summary by remember { mutableStateOf(false) }
    LaunchedEffect(step::class, (step as? Step.Failure)?.message) {
        summary = false
        // 完了の案内は「発券しています」を言い終えてから
        if (step !is Step.Issuing && step !is Step.Idle) step.voice().let { (name, text) -> vm.voice.play(name, text, after = step is Step.Done) }
    }

    if (step is Step.Idle || step is Step.NotRegistered) {
        AnimatedContent(step, transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) }, label = "idle") {
            if (it is Step.Idle) TopMenu(vm) else NotRegisteredScreen()
        }
        return
    }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            val entered = step.entered()
            HeaderBand(step.headline(), onSummary = entered?.let { { vm.sounds.beep(); summary = true } })
            Box(Modifier.weight(1f).fillMaxWidth()) {
                AnimatedContent(
                    targetState = step,
                    contentKey = { it::class },
                    transitionSpec = { fadeIn(tween(150)) togetherWith fadeOut(tween(100)) },
                    label = "step",
                ) { s ->
                    Box(Modifier.fillMaxSize()) {
                        when (s) {
                            is Step.Dates -> DatesScreen(s, vm)
                            is Step.Times -> TimesScreen(s, vm)
                            is Step.People -> PeopleScreen(s, vm)
                            is Step.Confirm -> ConfirmScreen(s, vm)
                            is Step.Issuing -> IssuingScreen()
                            is Step.Done -> DoneScreen(s, vm)
                            is Step.Failure -> FailureScreen(s)
                            is Step.CallStaff -> CallStaffScreen(s)
                            else -> {}
                        }
                    }
                }
            }
            when {
                step.hasFooter() -> FooterBand(
                    onCancel = { vm.sounds.beep(); vm.reset() },
                    onBack = vm::back,
                    onCall = { vm.callStaff() },
                )
                step is Step.Done -> FooterBand(onCancel = null, onBack = null, onCall = { vm.callStaff() })
                else -> FooterBand(onCancel = null, onBack = null, onCall = null)
            }
        }
        if (vm.loading) Wait()
        step.entered()?.takeIf { summary }?.let { (date, slot, people) ->
            Popup("ここまでの入力内容", onDismiss = { summary = false }) {
                Column(Modifier.fillMaxWidth().whiteTable()) {
                    TableRow("日付", date?.let { Dates.short(it) } ?: "－")
                    TableRow("時間", slot?.let { slotTime(it) } ?: "－")
                    TableRow("人数", people?.let { "${it}名" } ?: "－", last = true)
                }
                Spacer(Modifier.height(14.dp))
                KioskButton({ vm.sounds.beep(); summary = false }, Modifier.width(160.dp), minHeight = 48.dp) {
                    Text("閉じる", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        val warn = vm.secondsLeft?.takeIf { it <= 10 && step !is Step.Done }
        LaunchedEffect(warn != null) { if (warn != null) vm.voice.play("v_timeout") }
        warn?.let { ResetWarning(it) }
    }
}

private fun slotTime(s: Slot) = "${Dates.time(s.startTime)}〜${Dates.time(s.endTime)}"

@Composable
private fun BoxScope.Wait() {
    Popup("ご案内") {
        Text("しばらくお待ちください", color = Kiosk.Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        LinearProgressIndicator(color = Kiosk.Ink, trackColor = Kiosk.Body, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun BoxScope.ResetWarning(seconds: Int) {
    Popup("ご案内") {
        Text("まもなく最初の画面に戻ります", color = Kiosk.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text("$seconds", color = Buttons.Red.bottom, fontSize = 56.sp, fontWeight = FontWeight.Bold)
        Text("続けるときは画面にタッチしてください", color = Kiosk.SubInk, fontSize = 14.sp)
    }
}

// ---- 最初の画面（券売機のトップメニューにならう） ------------------------

@Composable
private fun GrayTopBand() {
    Row(
        Modifier.fillMaxWidth().background(Kiosk.Band).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("予約受付", color = Kiosk.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Clock()
    }
}

@Composable
private fun Clock() {
    var now by remember { mutableStateOf(Dates.nowShort()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = Dates.nowShort()
            delay(5000)
        }
    }
    Text(
        now,
        color = Color.White,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.background(Color(0xFF333333), RoundedCornerShape(6.dp)).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun CallButton(onClick: () -> Unit) {
    Box(
        Modifier
            .background(Color.Black, RoundedCornerShape(8.dp))
            .padding(2.dp)
            .border(2.dp, Color.White, RoundedCornerShape(6.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text("係員呼出", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun TopMenu(vm: KioskViewModel) {
    Column(Modifier.fillMaxSize().background(Color.White)) {
        GrayTopBand()
        Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(18.dp))
            Text("いらっしゃいませ", color = Kiosk.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(14.dp))
            // 主なボタン（題名・線・説明）
            KioskButton(vm::start, Modifier.fillMaxWidth(), minHeight = 132.dp, contentPadding = 14.dp) {
                Text("予約券を発券する", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Box(Modifier.padding(vertical = 10.dp).fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.7f)))
                Text("日付・時間・人数を選んでください", color = Color.White, fontSize = 17.sp)
            }
            Spacer(Modifier.height(8.dp))
            Text("▲ ここにタッチしてください", color = Buttons.Red.bottom, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.alpha(blink()))
            Spacer(Modifier.height(16.dp))
            vm.board?.let { DepartureBoard(it.date, it.slots, Modifier.fillMaxWidth()) }
            Spacer(Modifier.weight(1f))
            Text("予約券は開始時刻に受付へお持ちください", color = Kiosk.SubInk, fontSize = 14.sp, modifier = Modifier.padding(bottom = 10.dp))
        }
        LedTicker(vm.notice)
        Row(Modifier.fillMaxWidth().background(Kiosk.Band).padding(horizontal = 10.dp, vertical = 8.dp)) {
            Spacer(Modifier.weight(1f))
            CallButton { vm.callStaff() }
        }
    }
}

@Composable
private fun NotRegisteredScreen() {
    Column(Modifier.fillMaxSize().background(Color.White)) {
        GrayTopBand()
        Column(
            Modifier.weight(1f).fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Column(
                Modifier.fillMaxWidth().background(Color.Black, RoundedCornerShape(6.dp)).padding(vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("ただいま", color = Color.White, fontSize = 22.sp)
                Text("休止中です", color = Kiosk.Keyword, fontSize = 40.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(20.dp))
            Text("この端末は受付端末として登録されていません", color = Kiosk.Ink, fontSize = 16.sp)
            Spacer(Modifier.height(8.dp))
            Text("係員: 左上を3秒長押しして係員メニューから登録", color = Kiosk.SubInk, fontSize = 13.sp)
        }
        Box(Modifier.fillMaxWidth().height(56.dp).background(Kiosk.Band))
    }
}

// ---- ① 日付（カレンダー） --------------------------------------------------

@Composable
private fun DatesScreen(s: Step.Dates, vm: KioskViewModel) {
    val today = Dates.today()
    val months = s.dates.map { it.substring(0, 7) }.distinct()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(10.dp)) {
        WeekdayHeader()
        months.forEach { ym ->
            val (y, m) = ym.split("-").map { it.toInt() }
            MonthGrid(y, m, s.dates.toSet(), today) { vm.pickDate(it) }
            Spacer(Modifier.height(8.dp))
        }
        Text("選べる日: " + s.dates.joinToString("・") { Dates.short(it) }, color = Kiosk.Ink, fontSize = 15.sp, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
    }
}

@Composable
private fun WeekdayHeader() {
    Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, bottom = 4.dp)) {
        "日月火水木金土".forEachIndexed { i, c ->
            Text(
                "$c",
                color = when (i) { 0 -> Color(0xFFD32F2F); 6 -> Color(0xFF1565C0); else -> Kiosk.Ink },
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/** 1か月ぶんのカレンダー。受付している日だけ押せる（土曜は青・日曜は赤のボタン） */
@Composable
private fun MonthGrid(year: Int, month: Int, open: Set<String>, today: String, onPick: (String) -> Unit) {
    val (days, first) = Dates.monthLayout(year, month)
    val cells = List(first) { 0 } + (1..days).toList()
    Column(Modifier.fillMaxWidth().background(Kiosk.Panel).border(1.dp, Kiosk.PanelBorder).padding(4.dp)) {
        Text("${month}月", color = Kiosk.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 6.dp, top = 2.dp, bottom = 4.dp))
        cells.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth()) {
                (week + List(7 - week.size) { 0 }).forEachIndexed { i, d ->
                    Box(Modifier.weight(1f).padding(2.dp)) {
                        if (d > 0) {
                            val date = "%04d-%02d-%02d".format(year, month, d)
                            val on = date in open
                            val colors = when (i) { 0 -> Buttons.Sunday; 6 -> Buttons.Saturday; else -> Buttons.Charcoal }
                            KioskButton({ onPick(date) }, Modifier.fillMaxWidth(), enabled = on, colors = colors, minHeight = 46.dp, contentPadding = 0.dp, corner = 5.dp) {
                                Text(
                                    if (date == today) "本日" else "$d",
                                    color = if (on) Color.White else Color(0xFFE2E2E2),
                                    fontSize = if (date == today) 15.sp else 20.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---- ② 時間（列車の一覧にならう表） ----------------------------------------

@Composable
private fun TimesScreen(s: Step.Times, vm: KioskViewModel) {
    if (s.slots.isEmpty()) {
        Message("この日の予約枠はありません")
        return
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(10.dp)) {
        Column(Modifier.fillMaxWidth().whiteTable()) {
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                Text("時間", color = Kiosk.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(10.dp))
                Box(Modifier.width(1.dp).fillMaxHeight().background(Kiosk.Line))
                Text(
                    "空き状況",
                    color = Kiosk.Ink,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(118.dp).background(Kiosk.LabelCell).padding(vertical = 10.dp),
                )
            }
            s.slots.forEach { slot ->
                Box(Modifier.fillMaxWidth().height(1.dp).background(Kiosk.Line))
                SlotRow(slot) { vm.pickSlot(slot) }
            }
        }
        Text("○ 空きあり　△ 残りわずか　× 満席", color = Kiosk.SubInk, fontSize = 13.sp, modifier = Modifier.padding(start = 4.dp, top = 8.dp))
    }
}

@Composable
private fun SlotRow(slot: Slot, onClick: () -> Unit) {
    val a = slot.availability()
    Row(
        Modifier.fillMaxWidth().height(IntrinsicSize.Min).clickable(enabled = slot.bookable, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text("${Dates.time(slot.startTime)}⇒${Dates.time(slot.endTime)}", color = Kiosk.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text(a.text, color = Kiosk.SubInk, fontSize = 14.sp, modifier = Modifier.padding(start = 16.dp))
        }
        Box(Modifier.width(1.dp).fillMaxHeight().background(Kiosk.Line))
        Box(
            Modifier.width(118.dp).fillMaxHeight().background(if (slot.bookable) Kiosk.AvailCell else Color(0xFFF2F2F2)).padding(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (slot.bookable) {
                KioskButton(onClick, Modifier.width(84.dp), minHeight = 48.dp, contentPadding = 0.dp) {
                    Text(a.mark, color = a.color, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                Text(a.mark, color = a.color, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ---- ③ 人数 ----------------------------------------------------------------

@Composable
private fun PeopleScreen(s: Step.People, vm: KioskViewModel) {
    val max = minOf(vm.maxPeople, s.slot.remaining).coerceAtLeast(1)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("1組 ${max}名まで", color = Kiosk.SubInk, fontSize = 14.sp)
        (1..max).chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { n ->
                    KioskButton({ vm.pickPeople(s.slot, n) }, Modifier.weight(1f), minHeight = 100.dp) {
                        Text("${n}名", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        People(n)
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ---- ④ 確認 ----------------------------------------------------------------

@Composable
private fun ConfirmScreen(s: Step.Confirm, vm: KioskViewModel) {
    Column(Modifier.fillMaxSize().padding(10.dp)) {
        Column(Modifier.fillMaxWidth().whiteTable()) {
            TableRow("日付", "${Dates.monthDay(s.slot.date)}（${"日月火水木金土"[Dates.weekday(s.slot.date)]}）", valueSize = 24)
            TableRow("時間", slotTime(s.slot), valueSize = 24)
            TableRow("人数", "${s.people}名", valueSize = 24)
            Column(Modifier.fillMaxWidth().padding(10.dp)) {
                Text("ご案内", color = Kiosk.Ink, fontSize = 15.sp)
                Text("・予約券は開始時刻に受付へお持ちください", color = Kiosk.Ink, fontSize = 13.sp)
                Text("・取消・変更は受付の係員にお申し出ください", color = Kiosk.Ink, fontSize = 13.sp)
            }
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.weight(1f))
            Text("よろしければ", color = Kiosk.Ink, fontSize = 16.sp)
            Text(" ▶ ", color = Buttons.Green.bottom, fontSize = 18.sp)
            KioskButton(vm::confirm, Modifier.width(190.dp), colors = Buttons.Green, minHeight = 76.dp) {
                Text("確　認", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(6.dp))
    }
}

// ---- 発券 ------------------------------------------------------------------

@Composable
private fun IssuingScreen() {
    val t = rememberInfiniteTransition(label = "ticket")
    val paper by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart), label = "paper")
    Column(Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(24.dp))
        DeviceIllustration(paper = paper, highlight = 0f)
        Spacer(Modifier.height(20.dp))
        Text("そのままお待ちください", color = Kiosk.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        LinearProgressIndicator(color = Kiosk.Ink, trackColor = Color.White, modifier = Modifier.fillMaxWidth(0.8f))
    }
}

@Composable
private fun DoneScreen(s: Step.Done, vm: KioskViewModel) {
    val r = s.reservation
    val thanks = rememberAfter(4000)
    LaunchedEffect(thanks) { if (thanks && s.printError == null) vm.voice.play("v_thanks", after = true) }
    Column(Modifier.fillMaxSize().padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        if (s.printError == null) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                DeviceIllustration(paper = 1f, highlight = blink(500), modifier = Modifier.size(120.dp, 158.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("本体上部の", color = Kiosk.Ink, fontSize = 18.sp)
                    Text("取出口から", color = Kiosk.Highlight, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Text("お取りください", color = Kiosk.Ink, fontSize = 18.sp)
                }
            }
        } else {
            Column(
                Modifier.fillMaxWidth().background(Color.White).border(2.dp, Kiosk.ErrorBand).padding(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(s.printError, color = Kiosk.ErrorBand, fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text("この画面の予約番号を係員にお見せください", color = Kiosk.Ink, fontSize = 14.sp)
            }
        }
        Spacer(Modifier.height(10.dp))
        Column(Modifier.fillMaxWidth().whiteTable()) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("予約番号", color = Kiosk.Ink, fontSize = 15.sp, modifier = Modifier.width(84.dp).padding(start = 10.dp))
                Text(r.code, color = Kiosk.Ink, fontSize = 64.sp, fontWeight = FontWeight.Bold, letterSpacing = 8.sp, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(Kiosk.Line))
            TableRow("日時", "${Dates.short(r.date)}  ${Dates.time(r.startTime)}〜${Dates.time(r.endTime)}")
            TableRow("人数", "${r.people}名", last = true)
        }
        Spacer(Modifier.height(6.dp))
        Text("予約券は開始時刻に受付へお持ちください", color = Kiosk.Ink, fontSize = 15.sp)
        Spacer(Modifier.weight(1f))
        if (thanks) Text("ありがとうございました", color = Kiosk.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KioskButton(vm::reprint, Modifier.weight(1f), minHeight = 56.dp) {
                Text("もう一度印刷", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            KioskButton({ vm.sounds.beep(); vm.reset() }, Modifier.weight(1f), colors = Buttons.Green, minHeight = 56.dp) {
                Text("終　了", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
        }
        vm.secondsLeft?.let {
            Text("あと${it}秒で最初の画面に戻ります", color = Kiosk.SubInk, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

// ---- エラー・呼出 ----------------------------------------------------------

@Composable
private fun FailureScreen(s: Step.Failure) {
    Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().whiteTable().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(56.dp).background(Kiosk.ErrorBand, CircleShape), contentAlignment = Alignment.Center) {
                Text("！", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(14.dp))
            Text(s.message, color = Kiosk.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            Text("「前画面に戻る」でやり直せます", color = Kiosk.SubInk, fontSize = 14.sp)
        }
    }
}

@Composable
private fun CallStaffScreen(s: Step.CallStaff) {
    Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().whiteTable().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(80.dp).alpha(blink(400)).background(Buttons.Red.bottom, CircleShape).border(5.dp, Color(0xFFFFB4A2), CircleShape))
            Spacer(Modifier.height(18.dp))
            Text(s.reason, color = Kiosk.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            Text("そのままお待ちください", color = Kiosk.Ink, fontSize = 17.sp)
        }
    }
}

@Composable
private fun Message(text: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Text(text, color = Kiosk.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}
