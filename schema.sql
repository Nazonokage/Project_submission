-- ============================================================
-- Project-Submissions — Neon PostgreSQL Schema
-- Stack: Next.js + Neon + Nodemailer OTP + JWT (no Firebase, no OAuth)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFESSORS
-- ============================================================
CREATE TABLE professors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,    -- login identifier
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NOTE: no google_id, no firebase_uid — prof logs in via email OTP only

-- ============================================================
-- PROFESSOR OTPs  (email login)
-- ============================================================
CREATE TABLE professor_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp         TEXT NOT NULL,           -- 6-digit code
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id     UUID NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  term        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROJECT SLOTS
-- ============================================================
CREATE TABLE project_slots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  label                   TEXT NOT NULL,
  group_size              INT NOT NULL DEFAULT 1,
  titles_required_min     INT NOT NULL DEFAULT 2,
  titles_allowed_max      INT NOT NULL DEFAULT 50,
  duplicate_check         TEXT NOT NULL DEFAULT 'warn'
                            CHECK (duplicate_check IN ('strict', 'warn')),
  deadline                TIMESTAMPTZ,
  require_deployment_url  BOOLEAN NOT NULL DEFAULT false,
  require_tech_stack      BOOLEAN NOT NULL DEFAULT true,
  require_target_users    BOOLEAN NOT NULL DEFAULT false,
  locked                  BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  id_number   TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, id_number)
);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  slot_id     UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'forming'
                CHECK (status IN ('forming', 'locked')),
  max_size    INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STUDENT ↔ GROUP ↔ SLOT  (junction)
-- ============================================================
CREATE TABLE student_group_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id     UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  UNIQUE (student_id, slot_id)
);

-- ============================================================
-- GROUP INVITES
-- ============================================================
CREATE TABLE group_invites (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  class_id              UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  slot_id               UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  invited_student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invited_by_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TITLES
-- ============================================================
CREATE TABLE titles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  slot_id                 UUID NOT NULL REFERENCES project_slots(id) ON DELETE CASCADE,
  group_id                UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  text                    TEXT NOT NULL,
  description             TEXT NOT NULL,
  tech_stack              TEXT[],
  target_users            TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'rejected')),
  added_by                TEXT NOT NULL
                            CHECK (added_by IN ('student', 'prof')),
  submitted_by_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  added_by_prof_id        UUID REFERENCES professors(id) ON DELETE SET NULL,
  repo_url                TEXT,
  deployment_url          TEXT,
  repo_last_checked       TIMESTAMPTZ,
  verified_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_student_id   UUID REFERENCES students(id) ON DELETE SET NULL
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
  actor_id    UUID NOT NULL,
  action      TEXT NOT NULL,
  target_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_classes_prof_id         ON classes(prof_id);
CREATE INDEX idx_project_slots_class_id  ON project_slots(class_id);
CREATE INDEX idx_students_class_id       ON students(class_id);
CREATE INDEX idx_groups_class_slot       ON groups(class_id, slot_id);
CREATE INDEX idx_sgs_student_slot        ON student_group_slots(student_id, slot_id);
CREATE INDEX idx_invites_invited_student ON group_invites(invited_student_id, slot_id);
CREATE INDEX idx_titles_group_slot       ON titles(group_id, slot_id);
CREATE INDEX idx_titles_status           ON titles(class_id, slot_id, status);
CREATE INDEX idx_activity_class          ON activity_log(class_id, created_at);
CREATE INDEX idx_otps_email              ON professor_otps(email);
CREATE INDEX idx_otps_expires_at         ON professor_otps(expires_at);
