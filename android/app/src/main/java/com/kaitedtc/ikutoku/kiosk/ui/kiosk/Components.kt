package com.kaitedtc.ikutoku.kiosk.ui.kiosk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.kaitedtc.ikutoku.kiosk.api.Products
import com.kaitedtc.ikutoku.kiosk.api.Slot
import com.kaitedtc.ikutoku.kiosk.ui.theme.Kiosk
import com.kaitedtc.ikutoku.kiosk.util.Dates
import kotlinx.coroutines.delay
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform

// ---- ボタン ----------------------------------------------------------------

/** ボタンの色の組（上・下のグラデーション、縁、文字） */
data class ButtonColors(val top: Color, val bottom: Color, val border: Color, val text: Color)

object Buttons {
    /** 選ぶボタンの基本（濃い灰色に白文字） */
    val Charcoal = ButtonColors(Color(0xFF5E5E5E), Color(0xFF2E2E2E), Color(0xFF151515), Color.White)
    val Saturday = ButtonColors(Color(0xFF52709F), Color(0xFF253F6B), Color(0xFF15233D), Color.White)
    val Sunday = ButtonColors(Color(0xFF9C5050), Color(0xFF6B2626), Color(0xFF3D1515), Color.White)
    val White = ButtonColors(Color.White, Color(0xFFE6E6E6), Color(0xFF1A1A1A), Kiosk.Ink)
    val Green = ButtonColors(Color(0xFF3CC63C), Color(0xFF149114), Color(0xFF0B4F0B), Color.White)
    val Orange = ButtonColors(Color(0xFFF7A040), Color(0xFFDB6F14), Color(0xFF8A4510), Color.White)
    val Red = ButtonColors(Color(0xFFF2554F), Color(0xFFC9201B), Color(0xFF7A100D), Color.White)
    /** 選んでいないもの（空き状況のほかの日付など） */
    val Unselected = ButtonColors(Color(0xFFE4E4E4), Color(0xFFBEBEBE), Color(0xFF8A8A8A), Color(0xFF555555))

    /** 選んでいるもの（空き状況の日付など） */
    val Selected = ButtonColors(Color(0xFFFFE97A), Color(0xFFF5C400), Color(0xFF8A6D00), Kiosk.Ink)
    internal val Off = ButtonColors(Color(0xFFB4B4B4), Color(0xFF9E9E9E), Color(0xFF8A8A8A), Color(0xFFDCDCDC))
}

private val EDGE = 3.dp

/**
 * 券売機のボタン。下に影の厚みがある。押すと、へこんで（明暗が逆になり少し暗くなる）縁がオレンジに光る。
 * 離したあとも押した見た目を 0.15 秒残してから onClick する（どこを押したか分かるように。連打も防ぐ）。
 * 押せないときは薄い灰色。操作音は onClick の中で鳴らす（ViewModel の各操作が鳴らす）。
 */
@Composable
fun KioskButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors = Buttons.Charcoal,
    minHeight: Dp = 64.dp,
    contentPadding: Dp = 8.dp,
    corner: Dp = 6.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scope = rememberCoroutineScope()
    var flashing by remember { mutableStateOf(false) }
    val down = enabled && (pressed || flashing)
    val c = if (enabled) colors else Buttons.Off
    val shape = RoundedCornerShape(corner)
    Box(
        modifier
            .clickable(source, indication = null, enabled = enabled) {
                if (flashing) return@clickable
                flashing = true
                scope.launch {
                    delay(150)
                    flashing = false
                    onClick()
                }
            }
            .padding(bottom = EDGE),
        propagateMinConstraints = true,
    ) {
        // 下の影（押している間は消えて、ボタンが沈んだように見える）
        if (!down) Box(Modifier.matchParentSize().offset(y = EDGE).background(Color(0x66000000), shape))
        Box(
            Modifier
                .offset { IntOffset(0, if (down) (EDGE - 1.dp).roundToPx() else 0) }
                .heightIn(min = minHeight)
                .background(
                    // へこみ: 明暗を逆にして少し暗く
                    if (down) Brush.verticalGradient(listOf(c.bottom.darken(0.3f), c.top.darken(0.15f)))
                    else Brush.verticalGradient(listOf(c.top, c.bottom)),
                    shape,
                )
                .border(if (down) 3.dp else 1.5.dp, if (down) Kiosk.Highlight else c.border, shape)
                .padding(contentPadding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, content = content)
        }
    }
}

private fun Color.darken(f: Float) = Color(red * (1 - f), green * (1 - f), blue * (1 - f), alpha)

/** 赤い丸の「取消」 */
@Composable
fun CancelCircle(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        modifier
            .size(60.dp)
            .offset { IntOffset(0, if (pressed) 2.dp.roundToPx() else 0) }
            .background(Color(0xFF7A100D), CircleShape)
            .padding(2.dp)
            .background(Color.White, CircleShape)
            .padding(2.dp)
            .background(Brush.verticalGradient(listOf(Color(0xFFF2554F), Color(0xFFC9201B))), CircleShape)
            .clickable(source, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text("取消", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}

// ---- 見出し・帯 ------------------------------------------------------------

/** 見出しの文: 前 + 強調（黄色・大きめ） + 後。例: ご希望の【日付】をお選びください */
data class Headline(val before: String, val keyword: String, val after: String, val sub: String? = null, val green: Boolean = false)

/** 黒い見出し帯。2行目の右に「ここまでの入力内容」 */
@Composable
fun HeaderBand(h: Headline, onSummary: (() -> Unit)?) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Kiosk.HeaderTop, Kiosk.HeaderBottom)))
            .drawBehind {
                // 右側の細い横線の地紋
                var y = 0f
                while (y < size.height) {
                    drawLine(Color.White.copy(alpha = 0.06f), Offset(size.width * 0.45f, y), Offset(size.width, y), 1f)
                    y += 4.dp.toPx()
                }
            }
            .padding(start = 10.dp, end = 8.dp, top = 10.dp, bottom = 8.dp),
    ) {
        Text(headline(h), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 2)
        if (h.sub != null || onSummary != null) {
            Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(h.sub.orEmpty(), color = Color.White, fontSize = 15.sp, modifier = Modifier.weight(1f).padding(start = 8.dp))
                if (onSummary != null) {
                    Box(
                        Modifier
                            .background(Color(0xFF2A2A2A), RoundedCornerShape(6.dp))
                            .border(1.5.dp, Color(0xFFBDBDBD), RoundedCornerShape(6.dp))
                            .clickable(onClick = onSummary)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text("ここまでの\n入力内容", color = Color.White, fontSize = 11.sp, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}

private fun headline(h: Headline): AnnotatedString = buildAnnotatedString {
    append(h.before)
    withStyle(SpanStyle(color = if (h.green) Kiosk.KeywordGreen else Kiosk.Keyword, fontSize = 26.sp)) { append(h.keyword) }
    append(h.after)
}

/** 下の灰色の帯: 取消・前画面に戻る */
@Composable
fun FooterBand(onCancel: (() -> Unit)?, onBack: (() -> Unit)?) {
    Row(
        Modifier.fillMaxWidth().background(Kiosk.Band).heightIn(min = 72.dp).padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        onCancel?.let { CancelCircle(it) }
        Spacer(Modifier.width(12.dp))
        onBack?.let {
            KioskButton(it, Modifier.width(132.dp), colors = Buttons.Orange, minHeight = 44.dp, contentPadding = 4.dp) {
                Text("前画面に戻る", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** 画面の上に重ねる案内（黒い見出し付きの白い枠） */
@Composable
fun BoxScope.Popup(title: String, onDismiss: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Box(
        Modifier.matchParentSize().background(Color(0x99000000)).clickable(remember { MutableInteractionSource() }, indication = null) { onDismiss?.invoke() },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .padding(20.dp)
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(4.dp))
                .border(2.dp, Kiosk.Ink, RoundedCornerShape(4.dp)),
        ) {
            Text(
                title,
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Kiosk.HeaderTop, Kiosk.HeaderBottom))).padding(horizontal = 12.dp, vertical = 8.dp),
            )
            Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, content = content)
        }
    }
}

/** 表の1行（左に項目名のセル） */
@Composable
fun TableRow(label: String, value: String, valueSize: Int = 20, last: Boolean = false) {
    Row(Modifier.fillMaxWidth().heightIn(min = 52.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Kiosk.Ink, fontSize = 15.sp, modifier = Modifier.width(84.dp).padding(start = 10.dp))
        Text(value, color = Kiosk.Ink, fontSize = valueSize.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(horizontal = 8.dp, vertical = 8.dp))
    }
    if (!last) Box(Modifier.fillMaxWidth().height(1.dp).background(Kiosk.Line))
}

/** 白い表の枠 */
fun Modifier.whiteTable() = this
    .background(Color.White)
    .border(1.dp, Kiosk.PanelBorder)

// ---- 部品 ------------------------------------------------------------------

/** ゆっくり点滅（0.15〜1） */
@Composable
fun blink(periodMs: Int = 900): Float {
    val t = rememberInfiniteTransition(label = "blink")
    val a by t.animateFloat(1f, 0.15f, infiniteRepeatable(tween(periodMs, easing = LinearEasing), RepeatMode.Reverse), label = "a")
    return a
}

/** 空き状況の記号と文言（指定席の ○△× にならう）。mark は券売機の表、led は発車標の色 */
data class Availability(val mark: String, val text: String, val color: Color, val led: Color)

fun Slot.availability(): Availability = when (status) {
    "ok" -> Availability("○", "残り${remaining}名", Kiosk.MarkOk, Kiosk.LedGreen)
    "few" -> Availability("△", "残り${remaining}名", Kiosk.MarkFew, Kiosk.LedAmber)
    "full" -> Availability("×", "満席", Kiosk.SubInk, Kiosk.LedRed)
    "ended" -> Availability("－", "受付終了", Kiosk.SubInk, Kiosk.LedDim)
    else -> Availability("－", "受付停止", Kiosk.SubInk, Kiosk.LedDim)
}

/** 人の形（頭と胴）を n 人ぶん並べる。人数ボタン用 */
@Composable
fun People(n: Int, modifier: Modifier = Modifier, color: Color = Color(0xFFBDBDBD)) {
    Canvas(modifier.size(width = (14 * n + 6).dp, height = 30.dp)) {
        val w = 12.dp.toPx()
        val gap = 2.dp.toPx()
        repeat(n) { i ->
            val x = i * (w + gap) + 3.dp.toPx()
            drawCircle(color, radius = w * 0.38f, center = Offset(x + w / 2, w * 0.42f))
            drawRoundRect(color, topLeft = Offset(x, w * 0.92f), size = Size(w, size.height - w * 0.92f), cornerRadius = CornerRadius(w * 0.45f))
        }
    }
}

/**
 * 受付端末（V1s）の絵。上の取出口から券が出る。highlight で取出口を橙の枠で囲む（券売機の「ここから出る」の案内にならう）。
 * paper: 0〜1（券の出ている長さ）
 */
@Composable
fun DeviceIllustration(paper: Float, highlight: Float, modifier: Modifier = Modifier) {
    Canvas(modifier.size(width = 190.dp, height = 250.dp)) {
        val u = size.width / 190f
        fun r(x: Float, y: Float, w: Float, h: Float, c: Color, rad: Float = 0f) =
            drawRoundRect(c, topLeft = Offset(x * u, y * u), size = Size(w * u, h * u), cornerRadius = CornerRadius(rad * u))
        // 券（取出口より上だけ見える）
        val ph = 50f * paper
        if (ph > 0f) {
            r(58f, 60f - ph, 74f, ph, Color.White)
            drawRect(Color(0xFF9E9E9E), Offset(58f * u, (60f - ph) * u), Size(74f * u, ph * u), style = Stroke(1.5f * u))
            if (ph > 20f) for (k in 0..1) r(68f, 60f - ph + 10f + k * 12f, if (k == 1) 34f else 54f, 5f, Color(0xFFCFCFCF), 2f)
        }
        drawV1s(u)
        // 取出口を囲む橙の枠
        if (highlight > 0f) {
            drawRoundRect(
                Kiosk.Highlight.copy(alpha = highlight),
                topLeft = Offset(20f * u, 2f * u),
                size = Size(150f * u, 116f * u),
                cornerRadius = CornerRadius(8f * u),
                style = Stroke(4f * u),
            )
        }
    }
}

/**
 * 発車標（LED 表示板）風の空き状況。体験ごとにページを分け、行が多いときは5行ずつ切り替える。
 */
@Composable
fun DepartureBoard(date: String, slots: List<Slot>, modifier: Modifier = Modifier) {
    val pages = Products.group(slots)
        .flatMap { (product, list) -> list.chunked(4).map { product to it } }
        .ifEmpty { listOf("" to emptyList()) }
    var page by remember(slots) { mutableIntStateOf(0) }
    LaunchedEffect(pages.size) {
        while (pages.size > 1) {
            delay(5000)
            page = (page + 1) % pages.size
        }
    }
    val shape = RoundedCornerShape(6.dp)
    val (product, rows) = pages[page.coerceIn(0, pages.lastIndex)]
    Column(
        modifier
            .background(Kiosk.Board, shape)
            .border(3.dp, Color(0xFF3A3A3A), shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("空き状況", color = Kiosk.LedAmber, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(10.dp))
            Text(Dates.short(date), color = Kiosk.LedWhite, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            if (pages.size > 1) Text("${page + 1}/${pages.size}", color = Kiosk.LedDim, fontSize = 12.sp)
        }
        if (product.isNotEmpty()) {
            Text(Products.name(product), color = Kiosk.LedWhite, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.padding(top = 2.dp))
        }
        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(1.dp).background(Color(0xFF333333)))
        if (slots.isEmpty()) {
            Text("この日の予約枠はありません", color = Kiosk.LedDim, fontSize = 16.sp, modifier = Modifier.padding(vertical = 6.dp))
        }
        rows.forEach { slot ->
            val a = slot.availability()
            Row(Modifier.fillMaxWidth().height(28.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(Dates.time(slot.startTime), color = Kiosk.LedAmber, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(70.dp))
                Text("〜${Dates.time(slot.endTime)}", color = Kiosk.LedDim, fontSize = 13.sp, modifier = Modifier.width(64.dp))
                Spacer(Modifier.weight(1f))
                Text(a.mark, color = a.led, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(28.dp))
                Text(a.text, color = a.led, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Clip, modifier = Modifier.width(88.dp))
            }
        }
    }
}

/** 流れる案内（電光掲示板風）。文字が無ければ何も出さない */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LedTicker(text: String, modifier: Modifier = Modifier) {
    if (text.isBlank()) return
    Text(
        text.replace('\n', '　'),
        color = Kiosk.LedAmber,
        fontSize = 19.sp,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        modifier = modifier
            .fillMaxWidth()
            .background(Kiosk.Board)
            .padding(vertical = 7.dp)
            .basicMarquee(iterations = Int.MAX_VALUE, velocity = 60.dp),
    )
}

/** 電池の残量（0〜100）と充電中か */
data class BatteryState(val percent: Int, val charging: Boolean)

private fun Intent.battery(): BatteryState? {
    val level = getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    if (level < 0 || scale <= 0) return null
    val status = getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val plugged = getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
    val charging = plugged != 0 || status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    return BatteryState(level * 100 / scale, charging)
}

/** ACTION_BATTERY_CHANGED を受けて電池の状態を返す。sticky なので登録した時点の値がすぐ取れる */
@Composable
fun rememberBattery(): BatteryState? {
    val context = LocalContext.current
    var state by remember { mutableStateOf<BatteryState?>(null) }
    DisposableEffect(context) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) {
                state = intent.battery() ?: state
            }
        }
        val sticky = ContextCompat.registerReceiver(context, receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
        sticky?.battery()?.let { state = it }
        onDispose { context.unregisterReceiver(receiver) }
    }
    return state
}

/** 上の帯の電池の形と %。充電中は稲妻、20% 以下で充電していなければ赤く点滅 */
@Composable
fun BatteryGauge(modifier: Modifier = Modifier) {
    val b = rememberBattery() ?: return
    val low = b.percent <= 20 && !b.charging
    val fill = when {
        b.percent <= 20 -> Color(0xFFD32F2F)
        b.percent <= 50 -> Color(0xFFE0A000)
        else -> Color(0xFF2E9E2E)
    }
    Row(modifier.alpha(if (low) blink(500) else 1f), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(width = 34.dp, height = 18.dp)) {
            val nub = 3.dp.toPx()
            val stroke = 2.dp.toPx()
            val body = Size(size.width - nub, size.height)
            drawRoundRect(Kiosk.Ink, size = body, cornerRadius = CornerRadius(3.dp.toPx()), style = Stroke(stroke))
            drawRoundRect(Kiosk.Ink, topLeft = Offset(body.width, size.height * 0.3f), size = Size(nub, size.height * 0.4f), cornerRadius = CornerRadius(1.dp.toPx()))
            val inset = stroke + 1.dp.toPx()
            val w = (body.width - inset * 2) * b.percent.coerceIn(0, 100) / 100f
            drawRect(fill, topLeft = Offset(inset, inset), size = Size(w, body.height - inset * 2))
            if (b.charging) {
                // 稲妻（白で縁取りして、残量の色の上でも見えるように）
                val cx = body.width / 2
                val h = body.height
                val bolt = Path().apply {
                    moveTo(cx + h * 0.10f, h * 0.10f)
                    lineTo(cx - h * 0.28f, h * 0.56f)
                    lineTo(cx - h * 0.02f, h * 0.56f)
                    lineTo(cx - h * 0.12f, h * 0.90f)
                    lineTo(cx + h * 0.28f, h * 0.44f)
                    lineTo(cx + h * 0.02f, h * 0.44f)
                    close()
                }
                drawPath(bolt, Color.White, style = Stroke(1.5.dp.toPx()))
                drawPath(bolt, Kiosk.Ink)
            }
        }
        Spacer(Modifier.width(4.dp))
        Text(
            "${b.percent}%",
            color = if (low) Color(0xFFD32F2F) else Kiosk.Ink,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
        )
        if (b.charging) Text("充電中", color = Kiosk.Ink, fontSize = 12.sp, modifier = Modifier.padding(start = 3.dp))
    }
}

/** 表示を少し遅らせる（「ありがとうございました」など） */
@Composable
fun rememberAfter(ms: Long): Boolean {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(ms)
        shown = true
    }
    return shown
}

/**
 * 予約券の切り取り方（V1s にはカッターがない）: 上から出た券を手前（下）へ倒し、引っ張りながら斜めに切り取る。
 * 3.6 秒で「出る → 手前へ倒す → 斜めに引いて端から切れる → 離れる」をくり返す。
 */
@Composable
fun TearGuide(modifier: Modifier = Modifier) {
    val t by rememberInfiniteTransition(label = "tear").animateFloat(
        0f, 1f, infiniteRepeatable(tween(3600, easing = LinearEasing), RepeatMode.Restart), label = "t",
    )
    Canvas(modifier.size(width = 190.dp, height = 250.dp)) {
        val u = size.width / 190f
        fun r(x: Float, y: Float, w: Float, h: Float, c: Color, rad: Float = 0f) =
            drawRoundRect(c, topLeft = Offset(x * u, y * u), size = Size(w * u, h * u), cornerRadius = CornerRadius(rad * u))
        fun seg(a: Float, b: Float) = ((t - a) / (b - a)).coerceIn(0f, 1f)

        drawV1s(u)

        val slot = 60f
        val out = seg(0f, 0.22f)            // 出てくる
        val fold = seg(0.28f, 0.48f)        // 手前へ倒れる
        val pull = seg(0.52f, 0.78f)        // 斜めに引いて切れる
        val away = seg(0.78f, 0.9f)         // 離れる
        if (t > 0.92f) return@Canvas
        val len = 52f * out
        // 倒れ具合: 上向き（-len）→ 下向き（+len）
        val dy = -len * kotlin.math.cos(Math.PI * fold).toFloat()
        val top = minOf(slot, slot + dy)
        val h = kotlin.math.abs(dy).coerceAtLeast(1f)

        withTransform({
            translate(left = -40f * u * away, top = 70f * u * away)
            // 斜めに引く: 右の付け根を支点に左下へ傾く
            rotate(degrees = 22f * pull, pivot = Offset(132f * u, slot * u))
        }) {
            drawRect(Color.White, Offset(58f * u, top * u), Size(74f * u, h * u))
            drawRect(Color(0xFF9E9E9E), Offset(58f * u, top * u), Size(74f * u, h * u), style = Stroke(1.5f * u))
            if (h > 24f) for (k in 0..1) {
                val y = if (dy < 0) top + 10f + k * 12f else top + h - 15f - k * 12f
                r(68f, y, if (k == 1) 34f else 54f, 5f, Color(0xFFCFCFCF), 2f)
            }
            // 切れ目: 左端から右へ進む
            if (pull > 0f) {
                val p = androidx.compose.ui.graphics.Path()
                val end = 58f + 74f * pull
                var x = 58f
                p.moveTo(x * u, slot * u)
                var up = true
                while (x < end) {
                    x = minOf(end, x + 5f)
                    p.lineTo(x * u, (slot + if (up) -2f else 2f) * u)
                    up = !up
                }
                drawPath(p, Kiosk.Vermilion, style = Stroke(2f * u))
            }
        }

        // 引く向きの矢印（倒れたあと、斜め下へ）
        if (fold >= 1f && away == 0f) {
            val a = 0.5f + 0.5f * kotlin.math.sin(t * 40f)
            val c = Kiosk.Highlight.copy(alpha = 0.6f + 0.4f * a)
            val sx = 158f; val sy = 96f; val ex = 116f; val ey = 156f
            // 進む向きの単位ベクトルと、それに直交する向き
            val dx = ex - sx; val dy2 = ey - sy
            val l = kotlin.math.sqrt(dx * dx + dy2 * dy2)
            val ux = dx / l; val uy = dy2 / l
            val bx = ex - ux * 16f; val by = ey - uy * 16f
            drawLine(c, Offset(sx * u, sy * u), Offset(bx * u, by * u), 6f * u)
            val head = androidx.compose.ui.graphics.Path().apply {
                moveTo(ex * u, ey * u)
                lineTo((bx - uy * 10f) * u, (by + ux * 10f) * u)
                lineTo((bx + uy * 10f) * u, (by - ux * 10f) * u)
                close()
            }
            drawPath(head, c)
        }
    }
}

/**
 * SUNMI V1s を正面から見た形（190×250 の座標）。緑の本体（受付で使う V1s の色）、上に丸いプリンタ部と紙の出口（y = 60）、
 * 正面は黒いガラス面に画面。券は x = 58〜132 から出る
 */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawV1s(u: Float) {
    fun r(x: Float, y: Float, w: Float, h: Float, c: Color, rad: Float = 0f) =
        drawRoundRect(c, topLeft = Offset(x * u, y * u), size = Size(w * u, h * u), cornerRadius = CornerRadius(rad * u))
    val body = Color(0xFF2E9E62)
    val bodyDark = Color(0xFF1E6E43)
    // 本体
    r(32f, 84f, 126f, 162f, body, 16f)
    // プリンタ部（少し幅広で丸い）
    drawRoundRect(
        Brush.verticalGradient(listOf(Color(0xFF4CC285), body), startY = 50f * u, endY = 112f * u),
        topLeft = Offset(24f * u, 50f * u), size = Size(142f * u, 62f * u), cornerRadius = CornerRadius(28f * u),
    )
    // 紙の出口（上の縁）
    r(48f, 58f, 94f, 5f, Color(0xFF10301F), 2.5f)
    r(48f, 63f, 94f, 2f, bodyDark, 1f)
    // 正面の黒いガラス
    r(40f, 104f, 110f, 134f, Color(0xFF151515), 10f)
    // 画面
    r(46f, 112f, 98f, 98f, Color(0xFF9DB7D6), 3f)
    r(56f, 180f, 78f, 18f, Color(0xFF3A3A3A), 3f)
    // 下のボタン（戻る・ホーム・一覧）
    for (x in listOf(72f, 95f, 118f)) drawCircle(Color(0xFF555555), radius = 3.5f * u, center = Offset(x * u, 224f * u))
}
