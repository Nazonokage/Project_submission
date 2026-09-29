ALTER TABLE project_slots ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
