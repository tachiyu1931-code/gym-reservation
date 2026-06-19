# ジム利用記録システム ER図

本システムのデータベース（Supabase PostgreSQL）におけるエンティティの関連図、およびクライアント端末内のローカル一時保存領域（IndexedDB）のデータ構造を示します。

---

## 1. クラウドデータベース ER図 (Supabase PostgreSQL)

本システムは「マスタ登録なし」で動作しますが、学籍番号（`student_id`）をキーとして、過去の入力情報（`users_cache`）と実際の利用履歴（`usage_logs`）が論理的にリレーションを持っています。

```mermaid
erDiagram
    users_cache ||--o{ usage_logs : "1対多 (学籍番号で紐付け)"

    users_cache {
        VARCHAR student_id PK "学籍番号 (主キー)"
        VARCHAR name "氏名"
        VARCHAR department "学科"
        VARCHAR grade "学年"
        VARCHAR class_name "クラス名"
        TIMESTAMPTZ created_at "作成日時"
        TIMESTAMPTZ updated_at "更新日時"
    }

    usage_logs {
        BIGINT id PK "ログID (自動連番)"
        VARCHAR student_id FK "学籍番号 (users_cache.student_id と論理紐付け)"
        VARCHAR name "氏名"
        VARCHAR department "学科"
        VARCHAR grade "学年"
        VARCHAR class_name "クラス名"
        TIMESTAMPTZ checked_in_at "チェックイン時間"
        TIMESTAMPTZ created_at "レコード作成日時 (サーバー時間)"
    }
```

---}

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
    }
```

---

## 3. リレーションシップおよび運用の補足説明

* **物理キー制約を付与しない理由**:
  * `users_cache` と `usage_logs` の間には、物理的な外部キー制約（FOREIGN KEY）は付与していません。
  * 理由は、最初の利用時には `users_cache` にデータが存在しない状態で `usage_logs` に書き込みが発生するためです。
  * システムの登録処理の流れ：
    1. 利用ログ (`usage_logs`) にデータを登録する。
    2. 入力された学籍番号が `users_cache` に存在しなければ新規作成、存在すれば最新の情報で更新（UPSERT処理）を行う。
  * このように、アプリケーションのビジネスロジック側で整合性を担保するため、データベース上は緩やかな論理リレーションとして扱います。
