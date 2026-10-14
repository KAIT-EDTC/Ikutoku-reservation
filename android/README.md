# 受付アプリ（SUNMI V1s）

SUNMI V1s（Android 6.0）で予約を受け、予約券を内蔵プリンタで印刷する Kotlin + Jetpack Compose のアプリ。サーバーは変えず、ブラウザの `/kiosk` と同じ `/api/kiosk` を「受付端末の1台」として使う。調査と設計は [docs/sunmi-v1s.md](../docs/sunmi-v1s.md)。

Gradle のプロジェクトは npm workspaces や Cloudflare のビルドとは独立している。

## 構成

```
app/src/main/java/com/kaitedtc/ikutoku/kiosk/
  MainActivity.kt            # 全画面・常時点灯・戻るキー無効・キオスクの再開
  admin/                     # デバイス所有者（KioskAdminReceiver）とロックタスク等（KioskPolicy）
  api/                       # KioskApi（OkHttp。Cookie dev を自分で付ける）と JSON の型
  printer/                   # SunmiPrinter（印刷サービスに bind）と ReceiptRenderer（幅 384px の画像に日本語を描く）
  sound/Sounds.kt            # ピッ・ピンポン・ブッブー（波形をコードで作る。音源ファイルなし）
  sound/Voice.kt             # 音声案内（端末に日本語の音声合成があるときだけ。係員メニューでオン/オフ）
  store/DeviceStore.kt       # サーバーURL・端末トークン・端末名・暗証番号など（SharedPreferences）
  ui/kiosk/                  # 受付の画面（KioskViewModel が画面の流れ、KioskScreens が各画面、Components が券売機風の部品）
  ui/setup/                  # 係員メニューと暗証番号パッド
  util/Dates.kt              # 日付・時刻の表示（java.time は Android 8 からなので Calendar）
```

- 見た目は指定席券売機にならう（JR 東日本の公式「指定席券売機を体験する」の画面を参考）: 黒い見出し帯と黄色の強調語・灰色の地・濃い灰色のボタン・赤い丸の取消・橙の「前画面に戻る」・緑の確認・○△× の空き表。ロゴ・アイコン・画像・音声は使わない
- 文字は BIZ UDGothic（`app/src/main/res/font/`、SIL Open Font License。`third_party/BIZUDGothic-OFL.txt`）。レシートも同じ書体で描く
- 予約の流れ: 待機 → 日付 → 時間 → 人数 → 確認 →（プリンタ確認 → 予約 → 印刷）→ 完了。無操作が全体設定の「戻る秒数」続くと待機へ戻る
- 印刷できない状態（用紙切れなど）では予約しない。予約の送信後に通信が切れたら「係員にお知らせください」を出す（予約できたか分からないため。管理画面で確認する）
- 係員メニュー: 画面の**左上を3秒長押し** → 暗証番号。端末登録・テスト印刷・音量・キオスクの固定/解除・暗証番号の変更
- 管理画面で端末を無効化すると、アプリは 401 を受けて「準備中」になる

## 開発環境（Linux）

Android Studio は使わず、コマンドラインだけで開発する（容量を抑えるため）。

| 入れたもの | 場所 |
| --- | --- |
| JDK 17（Temurin） | `~/.local/jdk/` |
| Android SDK（cmdline-tools・platform-tools・Platform 35・Build-Tools 35） | `~/Android/Sdk` |
| エミュレータ（Android 6.0 / 720×1280 の AVD `v1s`。実機が無いときの確認用） | `~/Android/Sdk/emulator`, `~/.android/avd` |

`~/.zshrc` で `JAVA_HOME`・`ANDROID_HOME`・`PATH`（adb など）を設定している。`android/local.properties`（git 管理外）に `sdk.dir` がある。

```sh
cd android
./gradlew assembleDebug                  # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug                   # つないだ端末（またはエミュレータ）に入れる
./gradlew testDebugUnitTest              # 単体テスト
./gradlew lintDebug                      # minSdk 23 で使えない API などの確認
```

ライブラリは minSdk 23 で動く版に固定している（`gradle/libs.versions.toml`）。上げるときは各ライブラリの minSdk を確認する。

### ローカルのサーバーにつないで試す

```sh
npm run db:migrate && npm run db:seed   # リポジトリのルートで
npm run setup-otp                       # 認証アプリに登録（ローカル用）
npx wrangler dev --ip 0.0.0.0 --cwd server   # 同じ LAN の端末から繋がるように
```

アプリの係員メニューで、サーバーURL を `http://<PCのIP>:8787`（エミュレータからは `http://10.0.2.2:8787`）にして登録する。SUNMI 以外の端末で試すときは「印刷できないときは予約しない」をオフにする。

アプリの通信コードをサーバーに当てるテスト（端末登録 → 受付データ → 予約）:

```sh
KIOSK_TEST_SERVER=http://localhost:8787 KIOSK_TEST_OTP_SECRET=<setup-otp の手入力用キー> ./gradlew testDebugUnitTest
```

### 画面とレシートの確認

```sh
adb exec-out screencap -p > shot.png                                          # 画面
adb exec-out run-as com.kaitedtc.ikutoku.kiosk cat cache/receipt-top.png > r.png  # 最後に印刷した（しようとした）レシート。debug ビルドだけ
adb logcat -s AndroidRuntime:E SunmiPrinter                                   # エラー
```

V1s の ROM はエラー（`Log.e`）以外のログを捨てる（`Log.i`/`Log.w` は logcat に出ない）。調べるときは一時的に `Log.e` で出す。

V1s へは USB のまま `adb reverse tcp:8787 tcp:8787` すると、アプリのサーバーURL を `http://localhost:8787` にしてローカルの API に繋げられる（Wi-Fi 不要）。

エミュレータ: `emulator -avd v1s -no-audio`（画面なしなら `-no-window`）。

## V1s に入れる

1. V1s で「設定 → 端末情報 → ビルド番号」を7回タップ → 開発者向けオプションで「USB デバッグ」をオン
2. USB でつなぎ、`adb devices` で `device` と出ることを確認する
   - `no permissions` と出たら udev ルールが要る（sudo が必要）: `lsusb` で V1s の ID（`xxxx:yyyy`）を見て、`/etc/udev/rules.d/51-android.rules` に `SUBSYSTEM=="usb", ATTR{idVendor}=="xxxx", MODE="0660", GROUP="plugdev"` を書き、`sudo udevadm control --reload-rules` → 挿し直す
3. `./gradlew installDebug`
4. 係員メニュー（左上3秒長押し。初回は暗証番号なし）→ 端末名と認証アプリの6桁コードで登録 → テスト印刷 → **暗証番号を設定**

### キオスク（画面の固定）

ステータスバー・ホーム・タスク一覧を使えなくし、電源を入れたらこのアプリが起動するようにする。1回だけ PC から設定する。

```sh
# V1s から Google アカウントを一時的に外してから（アカウントがあると設定できない）
adb shell dpm set-device-owner com.kaitedtc.ikutoku.kiosk/.admin.KioskAdminReceiver
adb shell settings put secure immersive_mode_confirmations confirmed   # 「全画面表示中」の案内を出さない
```

係員メニュー →「固定する」。電源を入れ直すと、起動完了の通知（`BootReceiver`）でこのアプリが開き、固定に戻る（SUNMI の ROM はホームアプリを自社のランチャーに固定するので、ホームアプリの指定だけでは起動しない）。アプリを入れ直したあとは、一度アプリを開いておく（開くまで起動完了の通知を受け取れない）。解除は係員メニューの「解除する」、アプリを消すときは「デバイス所有者を外す」→ `adb uninstall com.kaitedtc.ikutoku.kiosk`。

## 本番用のビルド

```sh
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk（debug の鍵で署名。Play には出さない）
```

release では debug 用のレシート画像の保存はしない。
