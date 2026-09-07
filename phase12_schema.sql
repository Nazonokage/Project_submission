ALTER TABLE title_reports
  ADD COLUMN IF NOT EXISTS project_update_id uuid
  REFERENCES project_updates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_title_reports_project_update
  ON title_reports(project_update_id);
