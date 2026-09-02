-- Project-management additions. Safe to re-run.
-- Does not touch neon_auth.

-- Columns already present in some DBs (from your live dump)
ALTER TABLE professors ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Delivery / PM status on a title (separate from verify/reject)
ALTER TABLE titles ADD COLUMN IF NOT EXISTS progress_status TEXT NOT NULL DEFAULT 'planning';
ALTER TABLE titles ADD COLUMN IF NOT EXISTS last_commit_sha TEXT;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS last_commit_message TEXT;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS last_commit_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'titles_progress_status_check'
  ) THEN
    ALTER TABLE titles
      ADD CONSTRAINT titles_progress_status_check
      CHECK (progress_status = ANY (ARRAY['planning'::text, 'in_progress'::text, 'review'::text, 'done'::text]));
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS project_updates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  slot_id                 UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  group_id                UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title_id                UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  posted_by_student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
  posted_by_prof_id       UUID REFERENCES professors(id) ON DELETE SET NULL,
  kind                    TEXT NOT NULL DEFAULT 'progress'
                            CHECK (kind IN ('progress', 'commit', 'milestone', 'note')),
  headline                TEXT,
  body                    TEXT NOT NULL,
  commit_sha              TEXT,
  commit_url              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_title
  ON project_updates(title_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_updates_class
  ON project_updates(class_id, created_at DESC);
