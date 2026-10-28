CREATE TABLE IF NOT EXISTS feedback_reads (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_reads_student_feedback_unique UNIQUE (student_id, feedback_id)
);
