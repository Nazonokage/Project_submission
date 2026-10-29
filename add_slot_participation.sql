-- Keep class rosters intact. Exclude individual students only from selected slots.
ALTER TABLE project_slots ADD COLUMN IF NOT EXISTS excluded_student_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
