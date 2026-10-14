package com.kaitedtc.ikutoku.kiosk.ui.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kaitedtc.ikutoku.kiosk.api.userMessage
import com.kaitedtc.ikutoku.kiosk.printer.SunmiPrinter
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskControls
import com.kaitedtc.ikutoku.kiosk.ui.kiosk.KioskViewModel
import com.kaitedtc.ikutoku.kiosk.ui.theme.Kiosk
import kotlinx.coroutines.launch

/** 係員メニュー: 端末登録・テスト印刷・キオスク開始/解除・音量など */
@Composable
fun SetupScreen(vm: KioskViewModel, kiosk: KioskControls, onClose: () -> Unit) {
    val store = vm.store
    val scope = rememberCoroutineScope()
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    // store は SharedPreferences なので、変えたら version を上げて画面を描き直す（key(version) で読む）
    var version by remember { mutableIntStateOf(0) }
    val refresh = { version++ }

    var server by remember { mutableStateOf(store.serverUrl) }
    var name by remember { mutableStateOf(store.deviceName.ifEmpty { "受付V1s" }) }
    var otp by remember { mutableStateOf("") }
    var title by remember { mutableStateOf(store.receiptTitle) }
    var pin by remember { mutableStateOf("") }
    var volume by remember { mutableStateOf(store.volume.toFloat()) }

    Column(Modifier.fillMaxSize().background(Color.White)) {
        Row(Modifier.fillMaxWidth().background(Kiosk.Navy).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("係員メニュー", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Button(onClick = onClose, colors = ButtonDefaults.buttonColors(containerColor = Kiosk.Yellow, contentColor = Kiosk.Navy)) {
                Text("受付画面へ", fontWeight = FontWeight.Bold)
            }
        }
        message?.let {
            Text(it, color = Color.White, modifier = Modifier.fillMaxWidth().background(Kiosk.NavyLight).padding(10.dp))
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            key(version) {
                Status("端末", if (store.registered) "登録済み（${store.deviceName}）" else "未登録")
                Status("サーバー", store.serverUrl)
                Status("プリンタ", SunmiPrinter.stateMessage(vm.printer.state()))
                Status("キオスク", if (!kiosk.isDeviceOwner) "デバイス所有者ではありません" else if (kiosk.isLocked) "固定中" else "解除中")
            }

            Section("端末登録") {
                Text("管理画面の「受付端末」に、この名前で登録されます。認証アプリの6桁コードを入れてください。", fontSize = 13.sp)
                OutlinedTextField(server, { server = it }, label = { Text("サーバーURL") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(name, { name = it }, label = { Text("端末名") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    otp,
                    { otp = it.filter(Char::isDigit).take(6) },
                    label = { Text("認証アプリの6桁コード") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    enabled = !busy && otp.length == 6 && name.isNotBlank() && server.isNotBlank(),
                    onClick = {
                        busy = true
                        scope.launch {
                            store.serverUrl = server
                            message = try {
                                store.token = vm.api.register(otp, name.trim())
                                store.deviceName = name.trim()
                                "「${name.trim()}」として登録しました"
                            } catch (e: Exception) {
                                "登録できませんでした: ${e.userMessage()}"
                            }
                            otp = ""
                            busy = false
                            refresh()
                        }
                    },
                ) { Text("この端末を登録") }
                if (store.registered) {
                    OutlinedButton(onClick = {
                        store.token = null
                        message = "登録を消しました。管理画面でも無効化してください。"
                        refresh()
                    }) { Text("この端末の登録を消す") }
                }
            }

            Section("印刷") {
                OutlinedTextField(title, { title = it }, label = { Text("レシートの一番上（団体名・企画名）") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = !busy, onClick = {
                        store.receiptTitle = title
                        message = "印刷しています…"
                        busy = true
                        scope.launch {
                            message = vm.printer.printTest(store.deviceName, store.receiptTitle)?.let { "テスト印刷: $it" } ?: "テスト印刷しました"
                            busy = false
                            refresh()
                        }
                    }) { Text("保存してテスト印刷") }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("印刷できないときは予約しない", modifier = Modifier.weight(1f))
                    Switch(store.requirePrinter, { store.requirePrinter = it; refresh() })
                }
                Text("オフにするのは SUNMI 以外の端末で試すときだけ", fontSize = 12.sp, color = Kiosk.DisabledText)
            }

            Section("音量") {
                Slider(volume, { volume = it }, valueRange = 0f..100f, onValueChangeFinished = {
                    store.volume = volume.toInt()
                    vm.sounds.setVolume(store.volume)
                    vm.sounds.chime()
                })
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("音声案内", modifier = Modifier.weight(1f))
                    Switch(store.voiceGuide, { store.voiceGuide = it; vm.voice.enabled = it; refresh() })
                }
                Text(
                    if (vm.voice.available) "録音した案内が無い文は、端末の音声合成で読みます" else "録音した案内だけ鳴ります（この端末には日本語の音声合成がありません）",
                    fontSize = 12.sp,
                    color = Kiosk.DisabledText,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = vm.sounds::beep) { Text("ピッ") }
                    OutlinedButton(onClick = vm.sounds::chime) { Text("ピンポン") }
                    OutlinedButton(onClick = vm.sounds::buzzer) { Text("ブッブー") }
                    OutlinedButton(onClick = { vm.voice.play("v_take_ticket", "予約券を、お取りください") }) { Text("声") }
                }
            }

            Section("キオスク（画面の固定）") {
                Text(
                    "固定すると、ステータスバー・ホーム・タスク一覧が使えなくなり、電源を入れるとこのアプリが起動します。先に PC から adb でデバイス所有者にしておく必要があります（docs/sunmi-v1s.md 4-4）。",
                    fontSize = 13.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = kiosk.isDeviceOwner, onClick = {
                        message = if (kiosk.startKiosk()) "画面を固定しました" else "固定できませんでした（デバイス所有者ではありません）"
                        refresh()
                    }) { Text("固定する") }
                    OutlinedButton(onClick = {
                        kiosk.stopKiosk()
                        message = "固定を解除しました"
                        refresh()
                    }) { Text("解除する") }
                }
                if (kiosk.isDeviceOwner) {
                    OutlinedButton(
                        onClick = {
                            kiosk.releaseDeviceOwner()
                            message = "デバイス所有者を外しました。アプリをアンインストールできます。"
                            refresh()
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Kiosk.ErrorBand),
                    ) { Text("デバイス所有者を外す") }
                }
            }

            Section("係員メニューの暗証番号") {
                Text(if (store.staffPin.isEmpty()) "未設定（誰でも開けます）。必ず設定してください。" else "設定済み", fontSize = 13.sp)
                OutlinedTextField(
                    pin,
                    { pin = it.filter(Char::isDigit).take(8) },
                    label = { Text("新しい暗証番号（4〜8桁）") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(enabled = pin.length >= 4, onClick = {
                    store.staffPin = pin
                    pin = ""
                    message = "暗証番号を変更しました"
                    refresh()
                }) { Text("変更する") }
            }
            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun Status(label: String, value: String) {
    Row {
        Text(label, color = Kiosk.DisabledText, modifier = Modifier.padding(end = 12.dp), fontSize = 14.sp)
        Text(value, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    HorizontalDivider(Modifier.padding(vertical = 6.dp))
    Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Kiosk.Navy)
    Column(
        Modifier.fillMaxWidth().background(Kiosk.Background, RoundedCornerShape(8.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}
