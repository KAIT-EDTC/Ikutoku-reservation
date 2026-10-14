package com.kaitedtc.ikutoku.kiosk.ui.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.Buttons
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskButton
import com.kaitedtc.ikutoku.kiosk.ui.theme.Kiosk

/** 係員メニューに入るための暗証番号（ソフトキーボードを出さない数字パッド） */
@Composable
fun PinPad(expected: String, onCancel: () -> Unit, onOk: () -> Unit) {
    var input by remember { mutableStateOf("") }
    var wrong by remember { mutableStateOf(false) }
    val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "消", "0", "OK")

    Column(Modifier.fillMaxSize().background(Kiosk.Navy).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("係員メニュー", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))
        Text("●".repeat(input.length).ifEmpty { "暗証番号" }, color = Color.White, fontSize = 32.sp)
        Text(if (wrong) "番号が違います" else " ", color = Kiosk.Yellow, fontSize = 16.sp)
        Spacer(Modifier.height(16.dp))
        keys.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { k ->
                    KioskButton(
                        onClick = {
                            wrong = false
                            when (k) {
                                "消" -> input = ""
                                "OK" -> if (input == expected) onOk() else { wrong = true; input = "" }
                                else -> if (input.length < 8) input += k
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = if (k == "OK") Buttons.Green else Buttons.White,
                        minHeight = 68.dp,
                    ) { Text(k, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = if (k == "OK") Color.White else Kiosk.Ink) }
                }
            }
        }
        Spacer(Modifier.weight(1f))
        KioskButton(onCancel, Modifier.fillMaxWidth(), colors = Buttons.Red, minHeight = 60.dp) {
            Text("やめる", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}
