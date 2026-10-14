package com.kaitedtc.ikutoku.kiosk.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import com.kaitedtc.ikutoku.kiosk.R

/** 駅の券売機らしい配色（濃紺の帯・白いボタン・黄色の強調・朱色の取消）。実在の事業者の配色そのものは使わない */
object Kiosk {
    val Navy = Color(0xFF0D2B5E)
    val NavyDark = Color(0xFF071A3B)
    val NavyLight = Color(0xFF2A4F8F)
    val Background = Color(0xFFE6ECF4)
    val ButtonFace = Color.White
    val ButtonFaceTop = Color(0xFFFFFFFF)
    val ButtonFaceBottom = Color(0xFFE9EEF5)
    val ButtonBorder = Color(0xFF0D2B5E)
    val ButtonEdge = Color(0xFF8C9BB3)
    val Yellow = Color(0xFFFFCC00)
    val YellowEdge = Color(0xFFB88A00)
    val Vermilion = Color(0xFFE2421B)
    val VermilionEdge = Color(0xFF8E2A11)
    val Disabled = Color(0xFFC9CED6)
    val DisabledEdge = Color(0xFF9AA1AC)
    val DisabledText = Color(0xFF6B7280)
    val Text = Color(0xFF111827)
    val Ok = Color(0xFF15803D)
    val Few = Color(0xFFC2410C)
    val Full = Color(0xFFB91C1C)
    val ErrorBand = Color(0xFFC62828)

    // 指定席券売機の画面の作り（黒い見出し帯・灰色の地・濃い灰色のボタン・赤い丸の取消・橙の戻る・緑の確認）
    val HeaderTop = Color(0xFF000000)
    val HeaderBottom = Color(0xFF2B2B2B)
    val Keyword = Color(0xFFFFE34D)
    val KeywordGreen = Color(0xFF5CD65C)
    val Body = Color(0xFFDADADA)
    val Band = Color(0xFFA9A9A9)
    val Panel = Color(0xFFC9C9C9)
    val PanelBorder = Color(0xFF8A8A8A)
    val Line = Color(0xFFBDBDBD)
    val LabelCell = Color(0xFFEFEFEF)
    val AvailCell = Color(0xFFDFF5D8)
    val MarkOk = Color(0xFF7CE35A)
    val MarkFew = Color(0xFFFFB13B)
    val Highlight = Color(0xFFFF8C00)
    val Ink = Color(0xFF1A1A1A)
    val SubInk = Color(0xFF555555)

    // 発車標（LED 表示板）風
    val Board = Color(0xFF0B0B0B)
    val LedAmber = Color(0xFFFFA726)
    val LedGreen = Color(0xFF5EE07A)
    val LedRed = Color(0xFFFF5A4E)
    val LedWhite = Color(0xFFF2F2F2)
    val LedDim = Color(0xFF7A7A7A)
}

/** 券売機の画面に近い、読みやすい UD ゴシック（BIZ UDGothic、SIL OFL。third_party/ にライセンス） */
val UdGothic = FontFamily(
    Font(R.font.biz_ud_gothic_regular, FontWeight.Normal),
    Font(R.font.biz_ud_gothic_bold, FontWeight.Bold),
)

private fun Typography.withFamily(f: FontFamily): Typography {
    // 行の高さは文字の大きさの 1.3 倍（既定の固定値のままだと、大きな文字が折り返したとき行が重なる）
    fun TextStyle.f() = copy(fontFamily = f, lineHeight = 1.3.em)
    return copy(
        displayLarge = displayLarge.f(), displayMedium = displayMedium.f(), displaySmall = displaySmall.f(),
        headlineLarge = headlineLarge.f(), headlineMedium = headlineMedium.f(), headlineSmall = headlineSmall.f(),
        titleLarge = titleLarge.f(), titleMedium = titleMedium.f(), titleSmall = titleSmall.f(),
        bodyLarge = bodyLarge.f(), bodyMedium = bodyMedium.f(), bodySmall = bodySmall.f(),
        labelLarge = labelLarge.f(), labelMedium = labelMedium.f(), labelSmall = labelSmall.f(),
    )
}

@Composable
fun KioskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Kiosk.Navy,
            onPrimary = Color.White,
            secondary = Kiosk.Yellow,
            background = Kiosk.Background,
            surface = Color.White,
            error = Kiosk.ErrorBand,
        ),
        typography = Typography().withFamily(UdGothic),
        content = content,
    )
}
