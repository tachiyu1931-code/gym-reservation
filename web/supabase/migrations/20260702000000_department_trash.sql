-- 学科マスタ削除を論理削除・ゴミ箱復元に対応
ALTER TABLE departments_master ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE department_classes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_departments_master_active
    ON departments_master(sort_order, name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_department_classes_active
    ON department_classes(department_id, grade, sort_order)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION purge_old_deleted_records()
RETURNS VOID AS $$
BEGIN
    DELETE FROM usage_logs
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM users_cache
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days';

    DELETE FROM department_classes
    WHERE department_id IN (
        SELECT id FROM departments_master
        WHERE deleted_at IS NOT NULL
          AND deleted_at < NOW() - INTERVAL '30 days'
    );

    DELETE FROM departments_master
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
