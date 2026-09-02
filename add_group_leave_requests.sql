-- Professor-approved group leave requests.
-- Run in Neon SQL Editor (or drizzle-kit push). Safe to re-run.

CREATE TABLE IF NOT EXISTS group_leave_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  class_id              UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  slot_id               UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  resolved_at           TIMESTAMPTZ,
  resolved_by_prof_id   UUID REFERENCES professors(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_class_status
  ON group_leave_requests(class_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_requests_one_pending
  ON group_leave_requests(student_id, group_id)
  WHERE status = 'pending';
