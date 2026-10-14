# 予約システム

受付に置いた共用端末（iPad/PC）で予約を受け、空き状況はお客さんが自分の端末から見られるWebアプリ。DBに個人情報は持たない（予約は予約番号と人数だけ）。本番: https://fes.kaitedtc.com

| 区分 | URL | できること |
| --- | --- | --- |
| 公開（閲覧のみ） | `/` `/day/:date` `/guide` `/news` | 空き状況（○ 余裕 / △ 残りわずか / × 満員）、利用案内、お知らせ |
| 受付端末（登録済み端末のみ） | `/kiosk` | 日付 → コマ → 人数 → 確認 で予約。予約番号を表示し、一定時間でトップに戻る |
| 管理 | `/admin` | コマ・ひな形・全体設定（公開スイッチ）、予約一覧・代理予約・取消、受付端末、操作ログ |

管理画面は共有の管理者アカウント1つで、認証アプリ（TOTP）の6桁コードでログインする。

## 構成

```
.
├── shared/   # client と server で共有する日付処理・コマの判定（slotState）・zodスキーマ
├── server/   # Cloudflare Workers + Hono + Drizzle (D1)
└── client/   # React Router v7 (SPAモード) + Panda CSS
```

[EDTC ダッシュボード](https://github.com/KAIT-EDTC/dashboard) と同じ作りの npm workspaces モノレポ。client は server の `AppType` を型として import し、Hono RPC でエンドツーエンドに型付けする（入力は `shared` の zod スキーマでサーバー・クライアント両方が検証する）。

### server/src

```
app.ts                 # ルーティングの組み立て・CORS/CSRF・エラーハンドリング。AppType を export
env.ts                 # Bindings（環境変数）の型
db/schema.ts           # テーブル定義（スキーマの正。drizzle/ のマイグレーションはここから生成する）
middleware/auth.ts     # requireAdmin（管理者セッション）と requireDevice（受付端末の Cookie）
lib/                   # crypto（TOTP・HMAC）、audit（操作ログ）、errors、validator
features/
  public/              # 空き状況（閲覧のみ）
  kiosk/               # 受付端末の画面データと予約
  reservations/        # 予約確定 book()（定員の再判定はINSERT文の中）・代理予約・取消・検索
  slots/               # コマの取得（queries.ts）・日別/月表示・コマの追加/編集/削除
  templates/           # コマのひな形
  settings/            # 全体設定・認証アプリの再発行
  devices/             # 受付端末の登録・無効化
  logs/                # 操作ログ
  auth/                # 管理者ログイン（TOTP）・セッションCookie
```

### client/app

```
routes.ts              # URL とルートモジュールの対応（要件定義書8章の画面一覧）
routes/                # 1URL = 1ファイル。clientLoader / clientAction でデータを読み書きし、features の部品を並べるだけ
features/<機能>/        # その機能だけで使うUI・フック（admin の日別画面、kiosk の選択ボタン・自動リセットなど）
components/ui/         # 機能に依存しない部品（Button, Field, Card, Badge, Alert, Icons…）
components/layout/     # AppShell（管理画面の枠）, SiteShell（公開ページ）, KioskShell（受付端末）, PublicShell（ログイン）
lib/                   # APIクライアント（unwrap で401→受付端末なら / 、管理なら /admin/login）、フォーム補助、日付整形
theme/ (client直下)     # Panda のトークン・グローバルCSS（ダッシュボードと同じ）
```

- データ取得は `clientLoader`、更新は `<Form>` → `clientAction`。更新後は React Router が自動で再取得する
- スタイルは Panda CSS。色は意味ベースのトークン（`surface`, `fg.muted`, `accent`, `border` …）だけを使う

## 受付ルール

コマが予約できるかは `shared/src/slots.ts` の `slotState` が次の順に判定する。

1. 受付期間の外 → 受付停止 ／ 開始時刻を過ぎた → 終了
2. 残数 = 定員 − 有効な予約人数の合計。0なら満員で、予約できない

- 1コマだけ受付を止めたいときは、定員を今の予約人数まで下げる（満員になる）か、予約がなければコマを削除する
- 定員を減らしても既存の予約は消さない（画面に「定員超過」と出る）
- 定員超過防止（F-06）: 予約の INSERT 文そのものに「定員 − 有効予約数 ≥ 希望人数」の条件を入れており、2台が同時に確定しても超過しない
- 代理予約は受付期間・開始済みの判定を飛ばす（停止中に紙で受けた予約を後から入れるため）。定員超過は「定員超過を許可」のときだけ

## 開発

Node.js 22 以上が必要（`.nvmrc`）。

```sh
npm install                        # client の Panda CSS 生成も走る
npm run db:migrate                 # ローカルD1にマイグレーションを適用
npm run db:seed                    # 確認用のコマ・予約を入れる（任意）
npm run setup-otp                  # ローカルの管理者に認証アプリのQRを発行
npm run dev                        # client: http://localhost:5173 / server: http://localhost:8787
```

| コマンド | 内容 |
| --- | --- |
| `npm run typecheck` | 全ワークスペースの型チェック |
| `npm run lint` | client の ESLint |
| `npm test` | 判定ロジック・スキーマ（shared）と予約確定・TOTP（server）のテスト |
| `npm run build` | client のビルド（`client/build/client` に静的ファイル） |
| `npm run db:generate` | `server/src/db/schema.ts` からマイグレーションを生成 |
| `npm run db:seed` | ローカルD1に、受付期間の2日間ぶんのコマ（ID 9000番台）と予約・受付停止を入れる。何度実行しても同じ状態になる |
| `npm run db:seed:clear` | シードで入れたものだけを消す |

受付端末の画面を試すときは、管理画面の「受付端末」で今のブラウザを登録してから `/kiosk` を開く。

> 以前の構成（ルート直下の `.wrangler`）でローカルD1を使っていた場合、データは `server/.wrangler` に移らない。`npm run db:migrate` からやり直す。

## デプロイ（Cloudflare Workers）

1つのWorkerが、静的ファイル（client）と `/api/*` を同じオリジンから配信する（`server/wrangler.jsonc` の `env.production`）。デプロイ先は団体（Kait.edtc）のCloudflareアカウントで、`env.production.account_id` で固定してある。

```sh
npm run db:migrate:remote          # スキーマを変えた回は先に
npm run deploy                     # client をビルドして wrangler deploy --env production
npm run setup-otp -- --remote      # 初回、または全員が認証アプリを失くしたとき
```

`main` に push すると Cloudflare の Workers Builds（GitHub 連携）が自動でデプロイする。設定は Cloudflare ダッシュボードの Workers & Pages → `ikutoku-reservation` → Settings → Builds。

| 項目 | 値 |
| --- | --- |
| Branch | `main` |
| Root directory | `/` |
| Build command | `npm run typecheck && npm run lint && npm test && npm run build` |
| Deploy command | `npm run db:migrate:remote && npm run deploy -w server` |

型チェック・Lint・テストのどれかが失敗するとデプロイされない。ビルドのログは同じ画面の「Deployments」で見られる。

### 当日の準備

1. `/admin/settings` で受付期間（開催2日間）・最大人数・お知らせを設定
2. `/admin/templates` で曜日ごとのコマを登録 → 受付期間内のコマが自動で作られる（個別調整は `/admin/calendar`）
3. 受付用 iPad/PC で `/admin` にログイン → `/admin/devices` で「この端末を登録」→ ログアウト → `/kiosk` を開く
4. iPad はアクセスガイド、PC はブラウザのキオスクモードで固定
5. 端末を紛失したら `/admin/devices` で無効化

SUNMI V1s（レシートプリンタ付きの Android 端末）を受付端末に使う計画と手順は [docs/sunmi-v1s.md](docs/sunmi-v1s.md)。

### 補足

- バックアップ: D1 の Time Travel（7日分の任意時点に復元できる）。`cd server && npx wrangler d1 time-travel restore ikutoku-reservation --env production --timestamp=<ISO日時>`
- 管理者ログイン: TOTP（RFC 6238）。メンバー全員が同じQRを認証アプリに登録する。同じコードは1回しか使えない。追加・再発行は `/admin/otp`
- ログイン試行制限: 15分間に全体で10回失敗すると一時停止（IPアドレスを保存しないため全体で数える）
- アプリはIPアドレスや端末の詳細を保存しない
