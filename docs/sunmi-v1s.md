# SUNMI V1s を受付端末にする（調査と設計）

[#1](https://github.com/KAIT-EDTC/Ikutoku-reservation/issues/1) の調査と設計のまとめ。SUNMI V1s（型番 W5920）に Android アプリを入れて、予約と予約券（レシート）の印刷をできるようにする。

## 結論

- **サーバーと API は変えない。** V1s は「受付端末の1台」として今の `/api/kiosk` を使う。iPad/PC の受付（`/kiosk`）はそのまま残し、両方から同時に予約しても定員は守られる。
- **アプリは Kotlin + Jetpack Compose のネイティブアプリ**（`android/` に置く予定）。印刷は SUNMI 公式ライブラリ `com.sunmi:printerlibrary`。
  - V1s の WebView は 95 で更新できず、今の受付画面（Chrome 99 以上が必要）を WebView で表示する案は使えない。
  - 券売機風の UI を作りたい・レジにも使うかもしれない、という点でもネイティブが合う。
- 上のステータスバーと下のナビゲーションバー（戻る・ホーム・タスク一覧）は、**デバイス所有者＋ロックタスクモード＋全画面表示**で、表示されず押せない状態にする。
- アプリの開発は、V1s を USB でつないだ **ローカルの Linux で Claude Code を動かす**。
- 本番は 2026-11-07(土)〜08(日)。V1s が当日不調でも iPad/PC の受付だけで続けられる。

---

## 1. 今の設計

### 1-1. 全体像

```
 お客さんのスマホ ──── GET /api/public ─────────────────────┐ 閲覧のみ（公開スイッチOFFなら「準備中」）
 受付 iPad/PC（/kiosk）── /api/kiosk（Cookie dev）───────────┤
 管理者（/admin）──── /api/auth, /api/admin/*（Cookie admin_session）┤
                                                            ▼
      Cloudflare Worker「ikutoku-reservation」（https://fes.kaitedtc.com、1つの Worker で両方を配信）
        ├ 静的ファイル: client のビルド結果（HTML/JS/CSS。ブラウザの中で動く）
        └ /api/*: Hono のアプリ（server/src/app.ts）→ Drizzle ORM → Cloudflare D1（SQLite）
```

- 画面（client）と API（server）が分かれている。ブラウザはまず静的ファイルを読み込み、その JS が `/api/*` に JSON でデータを取りに行く。
- `main` に push すると Cloudflare の Workers Builds が typecheck → lint → test → build → D1 マイグレーション → デプロイする。

### 1-2. 3つのフォルダ（npm workspaces）

#### `shared/` — client と server の両方が使う「決まりごと」

同じ判定・同じ入力チェックを2か所に書かないための置き場。どちらも TypeScript なので、そのまま import できる。

| ファイル | 中身 |
| --- | --- |
| `shared/src/date.ts` | `nowJst()`: 日本時間の「今」を `{ date: 'YYYY-MM-DD', time: 'HH:MM', iso }` で返す（Workers は UTC で動くので +9時間して文字列で扱う）。`weekday()`・`addDays()`・`datesBetween()`（受付期間の日付一覧） |
| `shared/src/slots.ts` | **`slotState(slot, settings, now)`**: コマの状態を決める唯一の関数。判定順は「受付期間外 → `stopped`」「開始時刻を過ぎた → `ended`」「残数0 → `full`」「残数 ≤ max(2, 定員×30%) → `few`（△）」「それ以外 → `ok`（○）」。`bookable` は ok か few のとき |
| `shared/src/schemas/` | **zod スキーマ** = 「正しい入力の形」の宣言。例: `reserveSchema` は「slotId は整数、people は1以上の整数」。client は送る前にこれでチェックして画面にエラーを出し、server は届いた入力をこれでチェックして 400 を返す |

#### `server/` — Cloudflare Workers で動く API

| 道具 | 役割 |
| --- | --- |
| Cloudflare Workers | Cloudflare のサーバー上で動く小さなプログラム。サーバーの管理が要らない |
| Hono | Workers 向けの軽い Web フレームワーク。「この URL に来たらこの処理」と、全リクエスト共通の前処理（ミドルウェア）を書く |
| Drizzle ORM | SQL を TypeScript で型付きで書ける。`server/src/db/schema.ts` がテーブル定義の正で、`npm run db:generate` が `server/drizzle/*.sql`（マイグレーション）を作る |
| D1 | Cloudflare の SQLite。コードからは `c.env.DB` で使う。ローカルでは `server/.wrangler` の中のファイル |
| wrangler | ローカル実行・デプロイ・マイグレーション用のコマンド |

| 場所 | 中身 |
| --- | --- |
| `server/src/app.ts` | 入口。`/api/*` 共通で CORS → CSRF 対策 → セキュリティ用ヘッダ。エラーは `{ error }` の JSON にそろえる。機能ごとの route を `/api/public`・`/api/kiosk`… にぶら下げ、全ルートの型 `AppType` を export |
| `server/src/middleware/auth.ts` | `requireAdmin`（管理者 Cookie の確認）と `requireDevice`（受付端末 Cookie の確認） |
| `server/src/lib/` | `validator.ts`（zod の失敗を `{ error, fieldErrors }` の 400 に）、`errors.ts`（400/401/409 などの作り方）、`crypto.ts`（TOTP・SHA-256・HMAC・乱数トークン）、`audit.ts`（操作ログ） |
| `server/src/features/<機能>/` | 1機能1フォルダ。`routes.ts` が API、`queries.ts` が使い回すクエリ（`listSlots`: コマ＋有効な予約人数の合計、`eventDates`、`generateSlots`） |
| `server/test/` | `booking.test.ts`: wrangler の `getPlatformProxy` でメモリ上の D1 を作り、本物の SQL で `book()` を試す。`crypto.test.ts`: TOTP |

機能フォルダ: `public`（空き状況）/ `kiosk`（受付端末の画面データと予約）/ `reservations`（予約確定 `book()`・代理予約・取消・番号検索）/ `slots`（日別・月表示・コマの追加/編集/削除）/ `templates`（ひな形）/ `settings`（全体設定・認証アプリの再発行）/ `devices`（受付端末）/ `logs`（操作ログ）/ `auth`（管理者ログイン）

#### `client/` — ブラウザで動く画面

| 道具 | 役割 |
| --- | --- |
| React 19 ＋ React Router v7（SPA モード） | `client/react-router.config.ts` の `ssr: false`。ビルドすると静的ファイルになり、ブラウザの中だけで動く |
| Vite | ビルド |
| Panda CSS | `css({ ... })` と書くとビルド時にクラス名と CSS を作る。色などは `client/theme/tokens.ts` のトークン |

| 場所 | 中身 |
| --- | --- |
| `client/app/routes.ts` | URL とファイルの対応表（公開・受付端末・管理） |
| `client/app/routes/` | 1 URL = 1 ファイル。`clientLoader`（表示の前にデータを取る）、`clientAction`（`<Form method="post">` の送信を受ける）、画面のコンポーネント。更新のあと React Router が自動でデータを取り直す |
| `client/app/lib/api.ts` | **Hono RPC**: `hc<AppType>()` で server の型から API クライアントを作る。`api.kiosk.reservations.$post({ json })` のように呼ぶと URL・入力・出力に型が付き、server を変えて client が合っていなければ typecheck で落ちる。`unwrap()` は 401 をリダイレクト（受付端末なら `/`、管理なら `/admin/login`）にし、他のエラーを `ApiError` にする |
| `client/app/lib/form.ts` | `submit(schema, values, send)`: zod でチェック → API → エラーをフォーム表示用に整える |
| `client/app/features/` | 機能専用の部品（受付端末の大きな選択ボタン `ChoiceGrid`、無操作で戻る `useIdleReset`、管理の日別画面など） |
| `client/app/components/` | 汎用の部品（Button・Card…）と画面の枠（`KioskShell` など） |

### 1-3. 予約1件が DB に入るまで

1. 確認画面 `client/app/routes/kiosk/people.tsx` で「予約を確定する」→ `<Form method="post">` → `clientAction`
2. `submit(reserveSchema, …)`（`client/app/lib/form.ts`）が zod でチェック → `api.kiosk.reservations.$post({ json })`。`credentials: 'include'` なので、ブラウザが Cookie `dev` を自動で付ける
3. Worker の `server/src/app.ts`: CORS → CSRF 対策（JSON なので通る）→ `/api/kiosk` の `requireDevice`（Cookie のトークンを SHA-256 して `devices` と照合。無い・無効なら 401）→ `validate('json', reserveSchema)`（同じ zod でもう一度。だめなら 400）→ `server/src/features/kiosk/routes.ts` のハンドラ
4. `book()`（`server/src/features/reservations/book.ts`）: 設定とコマ（予約人数の合計つき）を読む → 人数が 1〜最大人数か → `slotState` で予約できるコマか → **「残数 ≥ 人数」を条件にした INSERT … SELECT を1文で実行**（0行なら満員）→ 予約番号が他と重なったら番号を変えてやり直し → 操作ログ
5. 201 `{ code, people, date, startTime, endTime }` → client の `unwrap()` → 完了画面（同じファイルの `Done`）が番号を大きく表示し、カウントダウンでトップへ

### 1-4. DB（`server/src/db/schema.ts`）— 個人情報は持たない

| テーブル | 中身 |
| --- | --- |
| `settings` | 1行だけ。受付期間（open/close）・1組の最大人数 `maxPeople`・無操作で戻る秒数 `resetSeconds`・お知らせ・公開スイッチ |
| `slot_templates` / `slots` | 曜日ごとのひな形と、日付ごとのコマ（定員 `capacity`、削除は論理削除） |
| `reservations` | コマID・人数・予約番号 `code`（4文字。0/O/1/I/L は使わない）・状態（active/cancelled）・誰が作ったか（`device` か `admin` ＋ ID） |
| `devices` | 受付端末。名前・トークンのハッシュ・有効/無効 |
| `admins` / `audit_logs` | 共有の管理者（TOTP の秘密鍵）/ 操作ログ |

### 1-5. 認証は3種類

- **公開**: 認証なし・閲覧のみ（`server/src/features/public/routes.ts`）
- **管理者**: 認証アプリの6桁コード（TOTP）→ HMAC 署名付き Cookie `admin_session`（12時間）（`server/src/features/auth/`）
- **受付端末**: 管理画面「受付端末」で「この端末を登録」→ サーバーが 32 バイトの乱数トークンを作り、DB にはハッシュだけ保存し、端末には httpOnly Cookie `dev`（400日）を渡す（`server/src/features/devices/routes.ts`）。紛失したら管理画面で無効化

### 1-6. 管理側のしくみ

- ひな形を登録・全体設定を保存すると `generateSlots()` が「受付期間の各日 × その曜日のひな形」でコマを作る（あるものはそのまま）
- 予約一覧には作成元の端末名が出る（`server/src/features/reservations/queries.ts`）→ V1s で入った予約は端末名（例: 受付V1s）つきで表示される
- 当日の照合は管理画面トップ（`/admin`）で予約番号を検索。`/admin?code=XXXX` でも直接開ける（`client/app/routes/admin/today.tsx`）

### 1-7. アプリを足すうえで効いてくる点

- **受付端末を1台増やす＝クライアントを1つ足すだけ。** 「Web とアプリの両方から予約」は今の設計のままでできる
- 定員の判定はサーバーの SQL 1文 → Web の受付とアプリが同時に予約しても定員を超えない
- 受付端末の認証は Cookie `dev` の中身（トークン）だけ → ネイティブでも `Cookie: dev=…` ヘッダを付ければ、ブラウザの受付端末と同じ扱い
- CORS はブラウザだけの仕組みなのでネイティブには関係ない。CSRF 対策（Hono の `csrf`）はフォーム形式の POST だけを見るので、`Content-Type: application/json` なら通る（ヘッダが無いと text/plain 扱いで 403 になる）

---

## 2. SUNMI V1s の調査結果

### 2-1. 端末

- 型番 **W5920 = SUNMI V1s**（SUNMI 公式カタログ）。**Android 6.0（API 23）**（実機で確認）
- 5.5インチ 1280×720 / ARM Cortex-A7（1.3GHz×4 程度）/ RAM 1GB・ROM 8GB / カメラ 5MP / バッテリー 5200mAh
- プリンタ: 58mm 感熱（SEIKO 製、ロール外径 40mm）、1行 384 ドット、**カッターなし**（手で切る）

### 2-2. 実機で確認したこと

| 項目 | 結果 |
| --- | --- |
| Android | 6.0 |
| WebView | 95.0.x。Play ストアの「アプリとデバイスの管理」に出てこない（Play から更新できない） |
| https://fes.kaitedtc.com | V1s の Chrome で証明書エラーなし。発行元は Google Trust Services |
| 日本語表示 | きれい |
| Play ストア・Google Play 開発者サービス | 入れてある（アプリはこれに依存させない） |

### 2-3. 印刷の方法（SUNMI 内蔵プリンタ開発者ドキュメントと公式デモより）

| 方法 | 内容 | 採否 |
| --- | --- | --- |
| 印刷サービス（AIDL） | 公式ライブラリ `com.sunmi:printerlibrary`（Maven Central、最新 1.0.24／2025年5月、minSdk 19 なので Android 6 でも使える）。`InnerPrinterManager.bindService()` で端末内の印刷サービス `woyou.aidlservice.jiuiv5` につなぎ、`SunmiPrinterService` で印刷する | 採用 |
| 仮想 Bluetooth「InnerPrinter」 | ESC/POS コマンドを直接送る | 不要 |
| H5（JS）連携 | 2021年8月の改訂（v1.1.210807）でドキュメントから削除されている | 使えない |

- 主な API（ライブラリ 1.0.24 の中身で確認）: `printText` / `setFontSize` / `setAlignment` / `printBitmap` / `printQRCode(data, moduleSize, errorLevel)` / `lineWrap(n)` / `enterPrinterBuffer(true)` → `exitPrinterBufferWithCallback(true, cb)`（まとめて印刷し、結果を `onPrintResult` で受け取る）/ `updatePrinterState()` / `getPrinterPaper()`（1 = 58mm）
- `updatePrinterState()` の値（公式デモ）: 1 正常 / 2 初期化中 / 3 ハード異常 / 4 用紙切れ / 5 過熱 / 6 カバーが開いている / 7 カッター異常 / 505 プリンタなし
- 日本語: 印字フォントは GB18030（中国語）前提の記述しか見つからない。**レシートは Android の Canvas で画像（Bitmap）に描いて `printBitmap`** で印刷する（端末の日本語表示はきれいなので、その字形がそのまま印字される）
- Android 11 以降の端末でも動くよう、`AndroidManifest.xml` に `<queries><package android:name="woyou.aidlservice.jiuiv5"/></queries>` を入れておく

### 2-4. 古い Android（6.0）で効く制約

| 制約 | V1s での結果 |
| --- | --- |
| 今の Web 画面は Chrome 99 以上が必要（Panda CSS の `@layer`。Vite 8 の既定のビルド対象は Chrome 111） | WebView は 95 で更新できない（Android 5〜6 は、どのアプリを WebView として使うかが端末側で固定）→ **WebView で今の画面を流用する案は不可** |
| Android 6 で動く Chrome/WebView は 106 が最後 | 更新できたとしても 106 まで |
| Let's Encrypt のルート（ISRG Root X1）が入ったのは Android 7.1.1 から。古い互換チェーンは 2024年9月に失効 | fes.kaitedtc.com は今 Google Trust Services 発行で、V1s から問題なく繋がる（→ 2-5） |
| React Native 0.76 以降 / Expo SDK 52 以降は minSdk 24（Android 7.0） | Android 6 には入らない |
| AndroidX / Jetpack Compose の既定 minSdk は 23 | 使える（使う版の minSdk が 24 に上がっていたら1つ前の版に固定する） |
| 古い Cortex-A7・RAM 1GB | Compose は最初に実機で動きを確かめる。重ければアニメーションを減らす |

### 2-5. 証明書の話（「ルート証明書を同梱する」とは）

- **HTTPS のしくみ**: サーバーは「サーバー証明書 → 中間証明書」を見せ、端末はそれが **OS に最初から入っている『信頼するルート証明書の一覧』** のどれかにつながるかを確かめる。つながらなければ証明書エラーで接続しない。
- **今は問題なし**: fes.kaitedtc.com の発行元は Google Trust Services で、Android 6 の一覧につながる（実機で確認）。Let's Encrypt 発行だった場合だけ、Android 6 の一覧に ISRG Root X1 が無いので繋がらない。
- **同梱とは**: その場合の対策。ISRG Root X1 の**公開証明書**（秘密ではない。letsencrypt.org で誰でも取れ、新しいスマホや PC には最初から入っている同じもの）を、アプリの通信部分（OkHttp）に「これも信頼してよい」と教える。Android 6 の一覧を、新しい Android と同じ状態に追いつかせるだけ。
- **安全か**: 本物のルートだけを足し（ISRG Root X1 の SHA-256 指紋 `96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6` を公式と照合する）、ホスト名・有効期限・署名の確認をそのまま残せば安全。影響はそのアプリの通信だけ。**やってはいけないのは「証明書エラーを無視する」実装**（何でも信頼する TrustManager など）で、盗聴・なりすましに無防備になる。
- **今回の扱い**: 必須ではない。Cloudflare が証明書を更新したときに発行元が変わると繋がらなくなるので、保険として入れるかはチームで決める。
- そもそも Android 6 自体が長くセキュリティ更新の無い OS。端末は受付専用にし、個人情報を扱わず、端末トークンは管理画面で無効化できる、という今の設計で被害を小さくしている。

---

## 3. 選択肢の比較（決定: ネイティブ）

| 案 | どう作るか | V1s での判定 |
| --- | --- | --- |
| WebView ラッパー | アプリの中で今の `/kiosk` を表示し、印刷だけアプリ | × WebView 95・更新不可で今の画面が動かない |
| **ネイティブ（Kotlin + Compose）** | API を直接呼ぶアプリ。印刷は SUNMI 公式ライブラリ | **採用**。WebView に左右されない。UI を自由に作れる。レジ用の画面も後から足せる |
| Flutter | Dart で画面、印刷は非公式プラグイン | △ 動くが Dart の習得＋非公式プラグイン依存 |
| React Native / Expo | TypeScript で書ける | × minSdk 24 で Android 6 に入らない |
| Capacitor / Cordova | 今の Web をアプリに同梱 | × 端末の WebView で動くので WebView ラッパーと同じ |
| （番外）公開ページから予約 | お客さんのスマホで予約 | 今回の範囲外（「予約は会場の受付で」の方針のまま） |

---

## 4. 設計

### 4-1. 全体像

```
 受付 iPad/PC ブラウザ（/kiosk）───┐
 SUNMI V1s アプリ（Kotlin）────────┼─ /api/kiosk（Cookie dev=…）→ 同じ Worker・同じ book()・同じ D1
                                   │
 V1s の中: アプリ ─ bind → SUNMI 印刷サービス（woyou.aidlservice.jiuiv5）→ 58mm プリンタ
```

### 4-2. サーバー / Web: 変更なし

- アプリは受付端末の1台として既存 API を使う。予約は `book()` を通るので、定員・受付期間・操作ログ（`created_by_type = device`）は Web の受付と同じ。
- **端末登録**は今の手順をアプリの中で行う:
  1. 係員メニューで、認証アプリの6桁コードと端末名を入力
  2. `POST /api/auth/login {code}`（管理者 Cookie を受け取る）
  3. `POST /api/admin/devices {name}` のレスポンスの `Set-Cookie: dev=…` からトークンを取り出して保存
  4. `POST /api/auth/logout {}`
  - 管理画面「受付端末」に並び、無効化されたらアプリは 401 を受けて係員メニューに戻る
- **使う API**
  - `GET /api/kiosk[?date=YYYY-MM-DD]` → `{ notice, maxPeople, resetSeconds, dates[], slots[{ id, date, startTime, endTime, status, remaining, bookable }] }`
  - `POST /api/kiosk/reservations {slotId, people}` → 201 `{ code, people, date, startTime, endTime }`（これをそのまま印刷に使う）
  - エラーは `{ error }`: 401 未登録・無効化 / 409 満員・受付停止 / 400 入力不正
- POST は必ず `Content-Type: application/json` を付ける（CSRF 対策の 403 を避ける。logout も `{}` を送る）。

### 4-3. Android アプリ（`android/`）

- Kotlin + Jetpack Compose、**minSdk 23**、OkHttp、kotlinx.serialization、coroutines、`com.sunmi:printerlibrary:1.0.24`。Google Play 開発者サービスには依存しない。
- Gradle のプロジェクトは npm workspaces や Cloudflare のビルドとは独立。
- 印刷と通信を画面から切り離し、レジ用の画面を後から `ui/register/` として足せる形にする。

| 場所（予定。パッケージ名は仮に `com.kaitedtc.ikutoku.kiosk`） | 中身 |
| --- | --- |
| `MainActivity.kt` | 全画面・常時点灯・縦固定・ロックタスク開始（4-4）・無操作で待機画面へ（`resetSeconds`） |
| `admin/KioskAdminReceiver.kt` ＋ `res/xml/device_admin.xml` | デバイス所有者（4-4） |
| `api/KioskApi.kt` / `api/Models.kt` | 上の2本＋端末登録3本。`Cookie: dev=…` を付ける |
| `printer/SunmiPrinter.kt` | 接続・状態確認・トランザクション印刷（画面に依存しない） |
| `printer/ReceiptRenderer.kt` | Canvas で幅 384px の画像に日本語を描く |
| `sound/Sounds.kt` ＋ `res/raw/*.ogg` | 操作音・チャイム・音声案内（4-5） |
| `ui/theme/` | 券売機風の色・文字・ボタン（4-5） |
| `ui/kiosk/` | 待機・日付・時間・人数・確認・発券中・完了（4-5） |
| `ui/setup/` | 係員メニュー（端末登録・テスト印刷・キオスク開始/解除・音量）。右上を3秒長押し＋暗証番号で入る |
| `store/DeviceStore.kt` | サーバー URL（既定 https://fes.kaitedtc.com）・端末トークン・端末名・係員の暗証番号（SharedPreferences） |
| `AndroidManifest.xml` | INTERNET、`<queries>`（印刷サービス）、デバイス管理の receiver、HOME の intent-filter（電源を入れたらこのアプリが起動する） |

**予約〜印刷の順番**

1. 確定ボタン → まず `updatePrinterState()`。1（正常）以外なら**予約せず**「係員をお呼びください（用紙切れ など）」
2. `POST /api/kiosk/reservations`
3. 成功したらトランザクション印刷（`enterPrinterBuffer` → レシート画像 → QR → `lineWrap(4)` → `exitPrinterBufferWithCallback`）
4. 完了画面: 番号を大きく表示＋「もう一度印刷」＋ `resetSeconds` のカウントダウン。印刷に失敗しても番号は画面に残る
5. 送信後に通信が切れた（予約できたか分からない）ときは「係員にお知らせください」→ 係員が管理画面で確認

**レシート**（58mm、幅 384px の画像。文言は仮）

```
   （団体名・企画名）
────────────────
      予約番号
       AB3K            ← 特大
────────────────
日時  11/7(土) 10:00–11:00
人数  2名
────────────────
      [QR]             ← https://fes.kaitedtc.com/admin?code=AB3K
                         （ログイン済みの係員スマホで読むと予約照会が開く）
開始時刻に受付へこの券をお持ちください
発券 11/7 9:41  受付V1s
（4行送り → 手で切る）
```

### 4-4. ステータスバー・ナビゲーションバーを消す（キオスク化）

ねらい: 上のステータスバーも、下の「戻る・ホーム・タスク一覧（四角）」も、**表示されず押せない**状態にする。Android 6 で root なしでできる組み合わせは次のとおり。

| 手段 | 何が消えるか | やり方 |
| --- | --- | --- |
| ロックタスクモード（デバイス所有者） | ホーム・タスク一覧ボタンが消える。ステータスバーは空になり通知も出ない。他のアプリを起動できない | アプリを adb で「デバイス所有者」にし、アプリが `setLockTaskPackages()` → `startLockTask()`（Android 9 未満はこの挙動で固定） |
| ステータスバーの無効化 | ステータスバーを引き下ろせない（通知・クイック設定） | デバイス所有者の `setStatusBarDisabled(admin, true)`（Android 6 から） |
| 全画面（immersive sticky） | ステータスバーとナビゲーションバーそのものを隠す | アプリ側で `SYSTEM_UI_FLAG_IMMERSIVE_STICKY \| HIDE_NAVIGATION \| FULLSCREEN` を常にかけ直す。端末全体に効かせるなら `adb shell settings put global policy_control immersive.full=com.kaitedtc.ikutoku.kiosk`（戻すときは `null`） |
| 戻るキーを無視 | 戻る | `onBackPressed()` を何もしないようにし、「もどる」はアプリ内のボタンだけにする |
| 画面ロックの無効化・ホームアプリ化 | ロック画面・再起動後の別アプリ | `setKeyguardDisabled(admin, true)`、HOME の intent-filter と `addPersistentPreferredActivity()` で電源投入時にこのアプリが起動 |

- 全画面にしても、画面の端からスワイプすると一瞬バーが半透明で出る。ただしロックタスク中はホーム・タスク一覧が無く、ステータスバーも空・無効なので押しても何も起きず、戻るはアプリが無視する → 実質「存在しない」状態になる。
- **デバイス所有者の設定**（1回だけ、PC から USB で）
  1. 端末から Google アカウントを一時的に外す（アカウントがあると設定できない）
  2. `adb install app-release.apk`
  3. `adb shell dpm set-device-owner com.kaitedtc.ikutoku.kiosk/.admin.KioskAdminReceiver`
  4. 必要ならアカウントを戻す
- **解除の手段を必ずアプリに入れる**: 係員メニューに「キオスク解除」（`stopLockTask()`・ステータスバー有効化）と「デバイス所有者を外す」（`clearDeviceOwnerApp()`）。Android 6 では、これが無いとデバイス所有者は初期化しないと外せない。
- やらないこと: `pm disable-user com.android.systemui`（SystemUI ごと止める）や `wm overscan` でバーを画面外に押し出す方法。バーは確実に消えるが、音量表示やエラー表示まで消え、戻せなくなる危険がある。
- SUNMI の新しい機種には「設定 → Lab → Kiosk」があるものもある。V1s にあれば併用してよいが、上の方法だけで足りる。

### 4-5. UI 案（JR 東日本の券売機風）

方針: 「駅の券売機っぽさ」を、画面構成・音・アニメーションで出す。**JR のロゴ・配色そのもの・実際の音声や効果音・画面の画像は使わない**（著作権・商標）。音とイラストは自分たちで作る。

> 実装（`android/`）では、JR 東日本公式の「[指定席券売機を体験する](https://www.jreast.co.jp/mv-guide/demo/index.html)」の画面の作り（黒い見出し帯と黄色の強調語・灰色の地・濃い灰色のボタン・赤い丸の取消・橙の「前画面に戻る」・緑の確認・○△× の空き表）にならった。下の画面図は当初の案。ロゴ・アイコン・画像・音声は使っておらず、絵（受付端末の図・人の形）はコードで描いている。

**画面の基本構成**（5.5インチ縦、720×1280）

```
┌──────────────────────────┐
│ ①日付 ②時間 ③人数 ④確認   [係員呼出] │ ← 濃紺の帯。いまどのステップか
│ ご希望の時間にタッチしてください       │ ← 案内文（大きな白文字）
├──────────────────────────┤
│  ┌──────────┐ ┌──────────┐  │
│  │  10:00   │ │  11:00   │  │ ← 運賃ボタン風の大きなボタン
│  │ 残り8名  │ │ 残り2名  │  │   （白地・太い枠。満員は灰色で「満」）
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │  13:00   │ │  14:00   │  │
│  │    満    │ │ 受付終了 │  │
│  └──────────┘ └──────────┘  │
├──────────────────────────┤
│ [ 取 消 ]                [ もどる ] │ ← 取消は朱色で常に同じ位置
└──────────────────────────┘
```

**画面の流れ**

1. **待機**: 「タッチしてください」がゆっくり点滅。時計と、お知らせ（`notice`）が流れる
2. **日付** → 3. **時間**（運賃ボタン風）→ 4. **人数**（「1名」〜「N名」の人数ボタン）
5. **確認**: 日時・人数を大きく。「予約する」ボタンは大きく黄色
6. **発券中**: 「発券中です しばらくお待ちください」。券が下からせり出すアニメーション
7. **完了**: 「予約券をお取りください」と、**プリンタの排出口（本体上部）を指す矢印**が点滅し、チャイムを繰り返す → 数秒後「ありがとうございました」→ 待機へ
8. **エラー**: 満員・通信エラーはブザー音＋赤い帯。「係員呼出」は「係員をお呼びください」画面（音を鳴らし続け、係員メニューから止める）

- どの画面でも左下「取消」で待機へ戻る。無操作で `resetSeconds` が経ったら待機へ（残り10秒で「まもなく最初の画面に戻ります」）。

**音**（`SoundPool` で鳴らす。遅延が少ない）

- タッチ音「ピッ」（短いビープ）、案内チャイム「ピンポン」、エラー「ブッブー」
- 音声案内（任意）: 「日付をお選びください」「予約券をお取りください」「ありがとうございました」など。部員の声で録るか、VOICEVOX などの無料音声合成で作る（利用規約に従いクレジットを表示）
- 起動時に音量を固定（`AudioManager`）。係員メニューで調整

**アニメーション**（Compose。古い CPU なので軽いものだけ）

- ボタンを押すと沈む（少し縮んで影が消える。80ms）→ 次の画面へ左右スライド（200ms）
- 矢印・「タッチしてください」の点滅、発券中の券のせり出し
- ぼかし・大きな影・重い画像は使わない。最初に実機でなめらかに動くか確認する

**見た目**: 駅らしい配色（濃紺の帯・白いボタン・黄色の強調・朱色の取消）、太く大きい文字、ボタンの高さは 64dp 以上。

### 4-6. レジとして使う場合（今回は作らない）

- 印刷部分（`printer/`）はそのまま使い回せる。レシートの中身を変えるだけ。
- 売上を記録するならサーバーに新しいテーブルと API が要る（予約とは別の機能）。決まったら別途設計する。

---

## 5. 開発環境: Android アプリはローカル（Linux）で開発する

| | ローカル（Linux ＋ V1s を USB 接続） | クラウド（Claude Code on the web など） |
| --- | --- | --- |
| 実機に入れて動かす | `./gradlew installDebug` ですぐ V1s で確認できる | できない（クラウドから手元の V1s には届かない）。APK を毎回ダウンロードして手で入れる |
| 画面の確認 | `adb exec-out screencap -p > shot.png` を Claude が読んで直す、`adb logcat` でエラーを見る、を繰り返せる | できない |
| 印刷・音・キオスク化の確認 | 実機でしかできない（エミュレータには SUNMI の印刷サービスが無い） | できない |
| Android のビルド | Android SDK を入れればできる | この設計をまとめたクラウド環境では `dl.google.com` がネットワーク設定で拒否されていて、SDK と Android 用ライブラリを取れなかった（許可すればビルドだけはできる） |
| 向いている作業 | アプリの開発全部 | 設計書・サーバー／Web の変更・レビューなど、実機が要らない作業 |

- ローカルの準備（Linux）
  - JDK 17 以上
  - Android SDK（Android Studio か command-line tools で platform-tools・SDK Platform・Build-Tools）
  - `adb devices` で V1s が見えること（V1s で「開発者向けオプション → USB デバッグ」を有効にする。見えなければ udev ルールを足す）
  - Claude Code（CLI）。リポジトリを clone して `android/` で作業する
- サーバーや Web を触るとき・文書はクラウドでもよい。

---

## 6. 当日の準備（アプリができたら）

1. 事前に PC から USB でアプリを入れ、デバイス所有者にする（4-4）。当日の通信は Wi-Fi
2. V1s の日付と時刻を自動にする（ずれると HTTPS が失敗する）
3. 係員メニューで6桁コード・端末名 → 登録 → テスト印刷 → キオスク開始
4. 給電しっぱなしにし、予備の 58mm ロール（外径 40mm 以下）を用意する

## 7. アプリができたら行う確認

- ローカル: `npm run dev`（server は `wrangler dev --ip 0.0.0.0` にして同じ LAN から繋がるようにする）に V1s から接続 → 登録 → 予約 → 印刷 → 管理画面に予約が端末名つきで出る → 管理画面で無効化すると予約できなくなる
- 同時予約: iPad と V1s で最後の1枠を同時に確定 → 片方だけ成功し、もう片方は 409 のメッセージ
- 用紙切れ: ロールを外して確定 → 予約されない
- キオスク: 画面端のスワイプ・戻る・再起動をしても、アプリ以外に出られない。係員メニューから解除できる
- 本番前: 本番 URL でテスト用のコマを作って同じ流れ → 終わったら取消・コマ削除

## 8. スケジュールの目安

- 〜10/24: アプリの最小版（予約＋印刷）。最初に実機で Compose の動きとテスト印刷を確認する
- 〜10/31: 実機で通しテスト・UI とレシートの見た目調整・当日手順の確認
- 11/7–8: 本番（iPad/PC の受付と並行）

---

## 参考

- SUNMI V1s 公式カタログ: https://file.cdn.sunmi.com/newebsite/Product/V1s/en/2018EN_V1S.pdf
- SUNMI 内蔵プリンタ開発者ドキュメント（EN）: https://file.cdn.sunmi.com/SUNMIDOCS/%E5%95%86%E7%B1%B3%E5%86%85%E7%BD%AE%E6%89%93%E5%8D%B0%E6%9C%BA%E5%BC%80%E5%8F%91%E8%80%85%E6%96%87%E6%A1%A3EN-0224.pdf
- SUNMI 公式デモ: https://github.com/shangmisunmi/SunmiPrinterDemo
- 公式ライブラリ（Maven Central）: https://repo1.maven.org/maven2/com/sunmi/printerlibrary/
- Chrome 106 が Android 6 で最後: https://forest.watch.impress.co.jp/docs/news/1443016.html
- WebView の提供元（Android 5〜6 は端末側で固定）: https://chromium.googlesource.com/chromium/src/+show/b5470ac602dd94de3fa37f35c8a2a3649c6d013d/android_webview/docs/webview-providers.md
- Let's Encrypt のチェーン変更と Android 7.1.1 以前: https://blog.cloudflare.com/shortening-lets-encrypt-change-of-trust-no-impact-to-cloudflare-customers
- AndroidX の既定 minSdk: https://developer.android.com/jetpack/androidx/versions
- ロックタスクモード: https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode
- Android 9 未満のロックタスクでホーム・通知などが無効になる件: https://www.hexnode.com/forums/topic/hide-status-bar/
- `policy_control` で全画面にする方法: https://www.howtogeek.com/302194/how-to-force-any-android-app-into-fullscreen-immersive-mode-without-rooting/
- SUNMI の Kiosk 設定（新しい機種）: https://chathelp.trycents.com/en/articles/12159694-using-kiosk-mode-on-your-sunmi-tablet
- JR 東日本 指定席券売機の画面刷新: https://trafficnews.jp/post/562908
- 印刷 API は Maven Central の公式ライブラリ本体と GitHub の公式デモで確認した。SUNMI の PDF とサイトは調査環境から直接は開けなかったため、上の PDF の中身は検索結果の要約による。
