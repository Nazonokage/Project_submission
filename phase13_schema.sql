ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS default_student_password text NOT NULL DEFAULT '2026';
