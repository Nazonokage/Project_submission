ALTER TABLE titles ADD COLUMN IF NOT EXISTS documentation jsonb;
ALTER TABLE title_reports DROP COLUMN IF EXISTS documentation;
ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS changelog text;
