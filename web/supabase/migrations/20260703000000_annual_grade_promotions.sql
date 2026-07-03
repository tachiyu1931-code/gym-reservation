-- 4月の学生キャッシュ自動進級・最終学年論理削除の実行履歴
CREATE TABLE IF NOT EXISTS annual_grade_promotions (
    school_year INTEGER PRIMARY KEY,
    promoted_count INTEGER NOT NULL DEFAULT 0,
    deleted_count INTEGER NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);