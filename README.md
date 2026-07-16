# GYM RESERVATION - ジム利用記録システム

入退室記録・管理システムです。学籍番号または教職員番号をスキャン／入力することで、チェックイン・チェックアウトを簡単に記録できます。

## 概要

- 学生・教職員がジム入り口の設置端末で学籍番号（またはカメラスキャン）を入力し、入室・退室を記録
- 管理者は `/admin` から、利用ログ・在室状況・学生キャッシュ・学科クラスマスタをWebブラウザで管理
- 詳細な仕様は [`doc/`](./doc) 配下の各設計書を参照してください
  - [企画書](./doc/企画書.md)
  - [要求分析書](./doc/要求分析.md)
  - [基本設計書](./doc/基本設計書.md)
  - [機能一覧](./doc/機能一覧.md)
  - [画面設計](./doc/画面設計.md)
  - [技術選定書](./doc/技術選定書.md)
  - [システム構成図](./doc/システム構成図.md)
  - [データベース定義書](./doc/データベース定義書.md)
  - [ER図](./doc/ER図.md)

## 主な機能

- 学籍番号（7桁数字）／教職員番号（`T` + 3桁）によるチェックイン・チェックアウト
- 学生証カメラスキャン（Raspberry Pi + Camera Module、OCR読み取り）
- 初回利用者向けの学科・学年・クラス選択式入力（マスタ管理、表記ゆれ防止）
- 2回目以降はキャッシュから氏名・所属を自動補完
- チェックイン後15時間が経過した場合の自動チェックアウト（一律30分として記録）
- 月間利用時間・連続利用日数のランキング表示
- 管理画面（Basic認証）
  - 利用ログ一覧・検索・CSVエクスポート
  - リアルタイム在室人数の確認
  - 学生キャッシュの確認・編集
  - 学科・クラスマスタの管理
  - 論理削除＋ゴミ箱（30日間復元可能）
  - 自動退室通知ベル
  - 4月の学年自動繰り上げ
- 日本語 / 英語の多言語対応
- オフライン時はブラウザの IndexedDB に一時保存し、オンライン復帰時に自動同期

## 技術スタック

| 区分 | 技術 |
| :--- | :--- |
| フレームワーク | Next.js (App Router) / TypeScript / Tailwind CSS |
| ホスティング | Vercel |
| データベース | Supabase (PostgreSQL) |
| 認証 | Basic認証 (Next.js Middleware) |
| OCR（学生証スキャン） | Raspberry Pi + Camera Module 3 / Tesseract (OpenCV) |
| 定期実行 | Vercel Cron（自動チェックアウト、ゴミ箱の物理削除） |

詳細は [技術選定書](./doc/技術選定書.md) を参照してください。

## セットアップ

### 必要環境

- Node.js（推奨: 18以上）
- npm

### 起動手順

```bash
cd web
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開くと利用者画面が表示されます。

### 環境変数なしでもすぐ試せます

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定しない場合、自動的にモックDB（`src/lib/mockDb.ts`）で動作します。Supabaseのセットアップをしなくても、チェックイン・チェックアウトや管理画面の動作確認が可能です。

### Supabaseに接続する場合

`.env.local` を作成し、以下を設定してください。

```bash
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase Anon Key
```

テーブル定義は [`web/supabase/schema.sql`](./web/supabase/schema.sql) を参照し、Supabase上で実行してください。

### 管理画面（`/admin`）にアクセスする場合

Basic認証がかかっているため、`.env.local` に以下を設定してください。

```bash
ADMIN_USER=任意のユーザー名
ADMIN_PASSWORD=任意のパスワード
```

### Vercel Cron（本番運用時）

以下のCronジョブ用エンドポイントを使う場合は `CRON_SECRET` の設定が必要です。

- `/api/cron/auto-checkout` : 15時間経過後の自動チェックアウト
- `/api/cron/purge-deleted` : ゴミ箱の30日経過データの物理削除

### 学生証カメラスキャン（Raspberry Pi）について

`raspi/` 配下はRaspberry Pi + Camera Module実機を前提とした別プロセスです。実機がない環境では動作しません。ローカル・Vercel上での動作確認では、手動入力によるチェックイン・チェックアウトをお試しください。

セットアップの詳細は [`raspi/env.example`](./raspi/env.example) を参照してください。

## ディレクトリ構成（抜粋）

```
web/                       Next.js アプリケーション本体
  src/app/                 ルーティング・APIルート
  src/features/            画面単位のコンポーネント（gym-checkin, admin）
  src/lib/                 DB接続・自動チェックアウト・利用統計などのロジック
  supabase/schema.sql       Supabaseテーブル定義
raspi/                     Raspberry Pi + カメラ用のOCRスキャンサーバー
doc/                       設計書一式
```
