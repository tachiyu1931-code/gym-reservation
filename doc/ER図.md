# ジム利用記録システム ER図

<!-- 変更履歴
  2026-06-25 更新:
  - §1 クラウドDB ER図: departments_master / department_classes テーブルを追加
  - §1 users_cache: is_staff / deleted_at カラムを追加
  - §1 usage_logs: checked_out_at / deleted_at カラムを追加
  - §3 補足説明: マスタテーブルとの関係、論理削除の運用ルールを追記
-->

本システムのデータベース（Supabase PostgreSQL）におけるエンティティの関連図、およびクライアント端末内のローカル一時保存領域（IndexedDB）のデータ構造を示します。

---

## 1. クラウドデータベース ER図 (Supabase PostgreSQL)

学科・クラスは `departments_master` / `department_classes` によるマスタ管理を採用し、`users_cache` および `usage_logs` には氏名・学科・学年・クラス名をスナップショットとして非正規化して保存します。これにより、マスタ変更後も過去ログの内容が変わらないことを保証します。

```mermaid
erDiagram
    departments_master ||--o{ department_classes : "1対多 (学科IDで紐付け)"
    departments_master ||--o{ users_cache : "参照 (学科名のマスタ)"
    users_cache ||--o{ usage_logs : "1対多 (学籍番号で紐付け)"

    departments_master {
        BIGINT id PK "学科ID (自動連番)"
        VARCHAR name "学科名 (UNIQUE)"
        SMALLINT years_count "修業年限"
        SMALLINT sort_order "表示順"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    department_classes {
        BIGINT id PK "クラスID (自動連番)"
        BIGINT department_id FK "学科ID (departments_master.id)"
        SMALLINT grade "対象学年"
        VARCHAR class_name "クラス名"
        SMALLINT sort_order "表示順"
        TIMESTAMPTZ created_at "作成日時"
    }

    users_cache {
        VARCHAR student_id PK "学籍番号 (主キー)"
        VARCHAR name "氏名"
        VARCHAR department "学科名 (スナップショット)"
        VARCHAR grade "学年 (スナップショット)"
        VARCHAR class_name "クラス名 (スナップショット)"
        BOOLEAN is_staff "教職員フラグ"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
        TIMESTAMPTZ deleted_at "論理削除日時 (NULLなら有効)"
    }

    usage_logs {
        BIGINT id PK "ログID (自動連番)"
        VARCHAR student_id FK "学籍番号 (users_cache.student_id と論理紐付け)"
        VARCHAR name "氏名 (スナップショット)"
        VARCHAR department "学科名 (スナップショット)"
        VARCHAR grade "学年 (スナップショット)"
        VARCHAR class_name "クラス名 (スナップショット)"
        TIMESTAMPTZ checked_in_at "チェックイン時間"
        TIMESTAMPTZ checked_out_at "チェックアウト時間 (NULLなら在室中)"
        TIMESTAMPTZ created_at "レコード作成日時"
        TIMESTAMPTZ deleted_at "論理削除日時 (NULLなら有効)"
    }
```

---

## 2. クライアント側 一時保存データ構造 (IndexedDB)

オフライン時に利用されるクライアントブラウザ内の独立したデータストア構造です。オンライン復帰時に、このデータが順次 `usage_logs` へと送信されます。

```mermaid
erDiagram
    offline_logs {
        NUMBER id PK "ローカルID (自動連番)"
        STRING student_id "学籍番号"
        STRING name "氏名"
        STRING department "学科"
        STRING grade "学年"
        STRING class_name "クラス名"
        STRING checked_in_at "チェックイン時間 (ISO 8601)"
        STRING action "操作種別 (checkin / checkout)"
    }
```

---

## 3. リレーションシップおよび運用の補足説明

### 3.1 マスタテーブルとスナップショット設計
* `departments_master` と `department_classes` は入力フォームの選択肢を提供するマスタです。
* `users_cache` および `usage_logs` の学科名・クラス名は、登録時点のマスタ値をそのまま文字列として保存します（スナップショット）。これにより、マスタのリネームや削除が過去ログに影響しません。
* `department_classes` のみ `departments_master` に対して物理外部キー制約を持ちます（学科削除時にクラスも連動削除）。

### 3.2 users_cache ↔ usage_logs 間の外部キー非設定
* `users_cache` と `usage_logs` の間には、物理的な外部キー制約（FOREIGN KEY）は付与していません。
* 理由は、最初の利用時には `users_cache` にデータが存在しない状態で `usage_logs` に書き込みが発生するためです。
* システムの登録処理の流れ：
  1. 利用ログ（`usage_logs`）にデータを登録する。
  2. 入力された学籍番号が `users_cache` に存在しなければ新規作成、存在すれば最新の情報で更新（UPSERT処理）を行う。
* アプリケーションのビジネスロジック側で整合性を担保するため、データベース上は緩やかな論理リレーションとして扱います。

### 3.3 論理削除の運用ルール
* `users_cache` および `usage_logs` の `deleted_at` カラムが `NULL` のレコードのみを「有効」として扱います。
* 管理者が削除操作を行うと `deleted_at` に現在時刻がセットされ、ゴミ箱に移動します。
* ゴミ箱から30日以内であれば復元可能です。
* 30日経過後は自動バッチ処理（またはSupabase Functionによるスケジューラ）により物理削除されます。

### 3.4 在室判定ロジック
* `usage_logs` において `checked_out_at IS NULL AND deleted_at IS NULL` かつ `checked_in_at > NOW() - INTERVAL '15 hours'` のレコードが「現在在室中」の判定対象です。
* チェックイン後15時間が経過しても `checked_out_at` が記録されていない場合は、バッチまたはAPI呼び出し時に自動で `checked_out_at = checked_in_at + INTERVAL '15 hours'` をセットします。