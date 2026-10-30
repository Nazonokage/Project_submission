-- Apply with the matching app release, after add_pm_schema.sql.
-- Repair old unapproved projects. Approved projects keep their progress.
UPDATE titles
SET progress_status = 'planning', updated_at = now()
WHERE status <> 'verified' AND progress_status IS DISTINCT FROM 'planning';

ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_approval_progress_check;
ALTER TABLE titles ADD CONSTRAINT titles_approval_progress_check
  CHECK (status = 'verified' OR progress_status = 'planning');
