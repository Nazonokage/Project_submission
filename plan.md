# Project-Submissions — Project Plan

A Next.js + Neon PostgreSQL app for professors to manage student project title
submissions, verification, grouping, and repo tracking — without requiring
students to create real accounts.

---

## 1. Core Concept

- **Prof** = real account, logs in via **email OTP** (no Google, no Firebase).
  Owns one or more **Classes**. A single prof can manage multiple classes
  at once — one per subject/section/term. Each class is fully isolated:
  its own roster, own project slots, own settings, own verification queue,
  own exports. Nothing crosses between classes.
- **Student** = no account needed. Imported via `.txt` (one name per line)
  or added manually. Logs in with **ID number + password** (prof sets,
  can edit later). Prof distributes credentials via Google Classroom /
  printed sheet / CSV.
- **Group** = the actual submitting unit. Solo = group of size 1.
- **Project Slot** = a class can have multiple project phases
  (e.g. "Project 1", "Project 2"), each with its own page, group-size
  rule, title cap, and deadline.

---

## 2. Roles

| Role | Access |
|---|---|
| Professor | Create classes, import students, set rules per project slot, verify/reject titles, view all groups, export data |
| Student | Log in with ID + password, view own class only, form/leave groups per slot, submit titles, see duplication warnings, see verified list, see students without a group, submit repo URL after verification |

---

## 3. Data Model (Neon PostgreSQL)

```
professors
  id (UUID PK)
  name, email (UNIQUE)
  created_at

professor_otps                  ← OTP login table
  id (UUID PK)
  email                         ← prof's email
  otp TEXT                      ← 6-digit code
  expires_at TIMESTAMPTZ        ← now() + 10 minutes
  used BOOLEAN DEFAULT false    ← invalidated after first use
  created_at

classes
  id (UUID PK)
  prof_id (FK → professors)
  name, term, created_at

project_slots
  id (UUID PK)
  class_id (FK → classes)
  label                         e.g. "Project 1 - Capstone Proposal"
  group_size                    1 = solo
  titles_required_min           default 2
  titles_allowed_max            default 50
  duplicate_check               'strict' | 'warn'
  deadline                      nullable
  require_deployment_url        boolean
  require_tech_stack            boolean
  require_target_users          boolean
  locked                        boolean
  created_at

students
  id (UUID PK)
  class_id (FK → classes)
  name, id_number, password
  UNIQUE(class_id, id_number)
  created_at

groups
  id (UUID PK)
  class_id (FK → classes)
  slot_id (FK → project_slots)
  status                        'forming' | 'locked'
  max_size, created_at

student_group_slots             ← junction table
  id (UUID PK)
  student_id (FK → students)
  group_id (FK → groups)
  slot_id (FK → project_slots)
  UNIQUE(student_id, slot_id)   ← one group per student per slot

group_invites
  id (UUID PK)
  group_id (FK → groups)
  class_id (FK → classes)
  slot_id (FK → project_slots)
  invited_student_id (FK → students)
  invited_by_student_id (FK → students)
  status                        'pending' | 'accepted' | 'declined'
  created_at

titles
  id (UUID PK)
  class_id (FK → classes)
  slot_id (FK → project_slots)
  group_id (FK → groups)
  text, description
  tech_stack TEXT[]             ← Postgres native array of tags
  target_users
  status                        'pending' | 'verified' | 'rejected'
  added_by                      'student' | 'prof'
  submitted_by_student_id (FK → students, nullable)
  added_by_prof_id (FK → professors, nullable)
  repo_url, deployment_url
  repo_last_checked, verified_at
  created_at, updated_at
  updated_by_student_id (FK → students, nullable)

activity_log
  id (UUID PK)
  class_id (FK → classes)
  actor_id (UUID)
  action TEXT                   e.g. 'title.verified', 'group.locked'
  target_id (UUID)
  created_at
```

---

## 4. Access Model

### Professor (Email OTP)
1. Prof enters email on `/login` page.
2. API route generates a 6-digit OTP → stores in `professor_otps`
   with `expires_at = now() + 10 minutes`.
3. Nodemailer (Gmail SMTP) sends the OTP to prof's email.
4. Prof enters OTP → API verifies:
   - OTP matches
   - Not expired (`expires_at > now()`)
   - Not already used (`used = false`)
5. On success → mark OTP as `used = true` → upsert prof into
   `professors` table → issue signed **JWT cookie** via `jose`.
6. All prof API routes validate this JWT server-side.

### Student (ID Number + Password)
1. Student visits `/c/[classId]/login`, enters ID number + password.
2. Next.js API route queries Neon:
   ```sql
   SELECT * FROM students
   WHERE class_id = $1 AND id_number = $2 AND password = $3
   ```
3. Server issues a signed **JWT session cookie** via `jose`,
   scoped to `studentId + classId`.
4. All student API routes validate this cookie — completely custom,
   no external auth.

---

## 5. Key Flows

### A. Class setup (Prof)
1. Create class → name, term.
2. Define project slots (label, group size, title cap, deadline,
   required fields). Slots can be added/edited/removed mid-term.
3. Import students via `.txt` → preview table → auto-generate passwords.
4. Manual add — single student form.
5. Edit student — name, ID number, password after import.
6. Export "Name | ID Number | Password" as CSV.

### B. Group formation (Student)
1. Log in → class dashboard.
2. Pick a project slot.
3. `groupSize === 1` → auto-assigned solo group → go to submission.
4. `groupSize > 1`:
   - Create group → invite from "students without a group" list.
   - Invitee sees all pending invites → accepts one → auto-declines rest.
   - Group locks when full → submission unlocks.

### C. Title submission (Student)
1. Must belong to a locked group (or solo).
2. Form: title, description, tech stack (tags), target users.
3. Live duplicate check via `ILIKE` against titles in same class/slot.
4. `strict` → blocked on match. `warn` → warning, can still submit.
5. Any group member can add/edit titles. Edits timestamped.

### D. Verification (Prof)
1. Dashboard lists pending titles per slot with description,
   tech stack, target users at a glance.
2. Approve / reject with optional comment.
3. On approval → status `verified`, repo URL field unlocks for group.
4. Prof can add a title directly to a group (auto-verified toggle).

### E. Repo tracking
1. After verification, any group member submits/updates repo URL.
2. If `require_deployment_url: true`, deployment URL also required.
3. Optional: API route pings GitHub for last commit → `repo_last_checked`.

### F. Views
- **Verified titles list** — public within class, filterable by slot,
  searchable by title/description/tech stack/target users.
- **Students without a group** — per slot, hidden for solo slots.
- **Prof dashboard** — pending queue, all groups, config, export.

### G. Export
- CSV export of titles/groups/status — client-side generation.

---

## 6. Pages (Next.js App Router)

```
/                               landing / prof email login
/login                          prof: enter email → OTP sent
/login/verify                   prof: enter OTP → session issued

/dashboard                      prof: list of classes
/dashboard/[classId]            prof: class overview, config,
                                  import students, manage slots
/dashboard/[classId]/[slotId]   prof: verification queue

/c/[classId]/login              student: ID number + password login
/c/[classId]/[slotId]           student: slot dashboard
    - group status / formation
    - "students without a group" list (if group slot)
    - title submission + live duplicate check
/c/[classId]/[slotId]/verified  verified titles list (student view)
```

---

## 7. Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14+ (App Router), deployed on Vercel |
| Database | **Neon PostgreSQL** — Project: `Project-Submissions` (Singapore) |
| DB Client | `@neondatabase/serverless` (pooled for API routes) |
| ORM | `drizzle-orm` + `drizzle-kit` (migrations) |
| Prof auth | Email OTP via **Nodemailer** (Gmail SMTP) |
| Prof + Student sessions | Signed JWT cookie via `jose` |
| CSV export | Client-side (`papaparse`) |

### Environment Variables (.env.local)
```env
# Neon
DATABASE_URL="postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require"
DATABASE_URL_POOLED="postgresql://neondb_owner:...@ep-...-pooler...neon.tech/neondb?sslmode=require"

# Gmail SMTP (Nodemailer)
GMAIL_USER="youremail@gmail.com"
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"

# JWT (run: openssl rand -base64 32)
JWT_SECRET="..."
```

No Firebase. No NextAuth. No Google OAuth. Pure Neon + Nodemailer + JWT.

---

## 8. Build Order

1. ✅ Neon DB created — `Project-Submissions`, Singapore region
2. ✅ Schema tables created (8 tables via schema.sql)
3. ⬜ Run OTP migration — add `professor_otps` table
4. ⬜ Scaffold Next.js project (`npx create-next-app@latest`)
5. ⬜ Install deps:
      `@neondatabase/serverless drizzle-orm drizzle-kit nodemailer jose papaparse`
6. ⬜ Set up `.env.local`
7. ⬜ DB client setup (`lib/db.ts`)
8. ⬜ Prof OTP login (`/login` → `/login/verify` → JWT cookie)
9. ⬜ Prof dashboard — class creation + project slot config
10. ⬜ Student `.txt` import + password generation + CSV export
11. ⬜ Student login → JWT session cookie
12. ⬜ Group formation (solo auto-assign + invite flow + lock)
13. ⬜ "Students without a group" view
14. ⬜ Title submission + live duplicate check
15. ⬜ Prof verification dashboard
16. ⬜ Verified titles view (student-facing)
17. ⬜ Repo URL submission
18. ⬜ CSV export

---

## 9. Open Decisions

- Duplicate check: `ILIKE '%keyword%'` (start here) vs. fuzzy match
  with `pg_trgm` Postgres extension (upgrade later if needed).
- Session length: prof JWT (e.g. 7 days), student JWT (e.g. 1 day or
  end of session).
- Tech stack field: free-text tags vs. autocomplete from previously-used
  values in that class — recommend autocomplete, self-curates over time.
- Target users: plain free text vs. presets + optional detail field.
- OTP cleanup: cron job or on-login cleanup of expired OTP rows.
