# Ikutoku-reservation

サークル予約システム（受付端末で予約・お客さんは空き状況の閲覧のみ・個人情報なし）。
Cloudflare Workers + D1。本番: https://fes.kaitedtc.com

| ディレクトリ | 中身 |
| --- | --- |
| `server/` | BE。Hono の JSON API（`/api/public` `/api/kiosk` `/api/admin`）。DB 操作は Drizzle。スキーマの正は `server/schema.ts` |
| `web/` | FE。React + Vite の SPA。API は Hono RPC（`hc<AppType>`）で型付きで呼ぶ |
| `migrations/` | `npm run db:generate`（drizzle-kit）が `server/schema.ts` から生成する SQL。手で編集しない（初期データ `0001_seed.sql` だけは手書き） |

1つの Worker が SPA を静的アセットとして配信し、`/api/*` だけ Hono が処理する。

| 区分 | URL |
| --- | --- |
| 公開（閲覧のみ） | `/` `/day/:date` `/guide` `/news` |
| 受付端末（登録済み端末のみ） | `/kiosk` |
| 管理 | `/admin`（認証アプリの6桁コードでログイン） |

## 開発

```sh
npm install
npm run db:migrate              # ローカルD1にスキーマ作成
npm run db:generate             # server/schema.ts を変えたら差分マイグレーションを生成
npm run setup-otp               # ローカルの管理者OTPを発行（QRを表示）
npm run dev                     # http://localhost:5173（FE と API を Vite で同時に起動）
npm test                        # 判定ロジック・予約確定のテスト
npm run typecheck               # server と web の型チェック
```

## デプロイ

```sh
npm run db:migrate:remote
npm run setup-otp -- --remote   # 初回、または全員がOTPを失くしたとき
npm run deploy                  # vite build → wrangler deploy
```

## 当日の準備

1. `/admin/settings` で受付期間（開催2日間）・最大人数・お知らせを設定
2. `/admin/templates` で曜日ごとのコマを登録 → 受付期間内のコマが自動作成される（個別調整は `/admin/calendar`）
3. 受付用 iPad/PC で `/admin` にログイン → `/admin/devices` で「この端末を登録」→ ログアウト → `/kiosk` を開く
4. iPad はアクセスガイド、PC はブラウザのキオスクモードで固定
5. 端末を紛失したら `/admin/devices` で無効化

## 補足

- 1コマだけ止めるときは受付不可ルール「特定コマのみ」（日別画面の「このコマだけ受付停止」も同じ）
- 定員超過防止: 予約の INSERT 自体に「定員 − 有効予約数 ≥ 希望人数」の条件を入れており、同時に確定しても超過しない
- バックアップ: D1 の Time Travel（無料プランで7日分の任意時点に復元可）を使う。復元は `npx wrangler d1 time-travel restore DB --timestamp=<ISO日時>`
- 管理者ログイン: TOTP（RFC 6238）。メンバー全員が同じQRを認証アプリに登録する共有アカウント。追加・再発行は `/admin/otp`。同じコードは1回しか使えない
- ログイン試行制限: 15分間に全体で10回失敗すると一時停止（IPを保存しないため全体でカウント）
- アプリはIPアドレスや端末情報を保存しない
