-- Notification bell support for auto checkout alerts.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS student_number TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

UPDATE notifications
SET is_read = is_acknowledged
WHERE is_read IS DISTINCT FROM is_acknowledged;

CREATE INDEX IF NOT EXISTS idx_notifications_read_created
    ON notifications(is_read, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_auto_checkout_unique
    ON notifications(usage_log_id, type)
    WHERE usage_log_id IS NOT NULL AND type = 'auto_checkout';


-- Backfill notifications for rows that were already auto-checked out before this feature was added.
INSERT INTO notifications (
    type,
    usage_log_id,
    student_number,
    department,
    grade,
    name,
    message,
    is_read,
    is_acknowledged
)
SELECT
    'auto_checkout',
    logs.id,
    logs.student_id,
    logs.department,
    logs.grade,
    logs.name,
    logs.student_id || ' ' || logs.name || ' さんが15時間経過により自動退室になりました。',
    FALSE,
    FALSE
FROM usage_logs logs
WHERE logs.auto_checked_out = TRUE
  AND logs.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM notifications existing
      WHERE existing.type = 'auto_checkout'
        AND existing.usage_log_id = logs.id
  )
ON CONFLICT DO NOTHING;CREATE OR REPLACE FUNCTION auto_checkout_old_logs(auto_checkout_time_threshold TIMESTAMPTZ)
RETURNS VOID AS $$
BEGIN
    WITH updated_logs AS (
        UPDATE usage_logs
        SET checked_out_at = checked_in_at + INTERVAL '15 hours',
            auto_checked_out = TRUE,
            admin_confirmed = FALSE
        WHERE checked_out_at IS NULL
          AND deleted_at     IS NULL
          AND checked_in_at  < auto_checkout_time_threshold
        RETURNING id, student_id, department, grade, name
    )
    INSERT INTO notifications (
        type,
        usage_log_id,
        student_number,
        department,
        grade,
        name,
        message,
        is_read,
        is_acknowledged
    )
    SELECT
        'auto_checkout',
        id,
        student_id,
        department,
        grade,
        name,
        student_id || ' ' || name || ' さんが15時間経過により自動退室になりました。',
        FALSE,
        FALSE
    FROM updated_logs
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;