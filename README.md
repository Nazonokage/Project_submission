# Project-Submissions

Next.js 14 + Neon PostgreSQL app for professors to manage student project title
submissions, verification, grouping, and repo tracking — no student accounts required.

Implementation through Phase 18 (v1.7.3), tracked in `todo.md`. See
[the Phase 14–16 review](docs/phase14-16-review.md) for verification results and
remaining release checks.

## ⚠️ Before you do anything else

The Gmail app password and JWT secret from your old `.env` were shared in a
screenshot/chat earlier. **Rotate both** before deploying this:
- Gmail → regenerate an App Password (Google Account → Security → App Passwords)
- JWT_SECRET → regenerate with the command below

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:
- `DATABASE_URL` / `DATABASE_URL_POOLED` — from your Neon dashboard (Project-Submissions, Singapore)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — a fresh Gmail App Password
- `JWT_SECRET` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

## 3. Database

Your Neon DB has all 17 tables (professors, professor_otps, classes, students, project_slots, documentation_field_templates, groups, student_group_slots, group_invites, group_leave_requests, titles, tasks, title_reports, project_updates, feedback, activity_log, rate_limits). You can manage migrations with `npm run db:generate` / `npm run db:push` or check database schema health with `npm run db:health` — the schema in `src/lib/schema.ts` mirrors the database schema.

## 4. Run

```bash
npm run dev
```

- Professor: `http://localhost:3000/login` → email OTP → `/dashboard`
- Student: `http://localhost:3000/c/<classId>/login` (link is shown on each
  class's dashboard page, with a copy button)

## What's implemented

- **Prof auth**: email → 6-digit OTP (10 min expiry, single use) → JWT cookie (`prof_token`, 7 days)
- **Student auth**: ID number + password → JWT cookie (`student_token`, 1 day)
- **Classes & project slots**: create/edit/delete, per-slot group size, title caps,
  duplicate-check mode (`strict`/`warn`), required-fields toggles, locking
- **Student roster**: `.txt` bulk import (auto-generates ID numbers + passwords),
  manual add, inline edit, CSV export
- **Groups**: solo auto-assign on first visit to a solo slot; multi-member create +
  invite + accept/decline (accepting auto-declines other pending invites); auto-locks
  when full; "students without a group" list; leave request flow with prof approval
- **4-Tab Student Slot Dashboard (`/c/[classId]/[slotId]`)**:
  - **`Titles` (Default)**: Class-wide verified titles list for browsing ideas and preventing duplicate work.
  - **Smart default**: Defaults to `Titles` when exploring, auto-switches to `Submissions` once a title is verified.
  - **`Submissions`**: Manage group title proposals. When 0 verified titles exist, the submit form is shown inline; once 1+ verified titles exist, the form turns into a modal dialog.
  - **Full Title Editing**: Students can edit title text, description, tech stack, and target users for all titles (pending, rejected, and verified).
  - **Progress Reports**: Inline on verified title cards (showing latest reports + expandable list + version report submission modal).
  - **`Board`**: Kanban board (`Planning` · `In Progress` · `Review` · `Done`) for verified titles with multi-title dropdown selector.
  - **Project Updates**: Activity feed inside the Board where group members can post, edit, and soft-delete progress updates, milestone entries, and notes.
  - **`My Group`**: Group management, member list, invitations, and leave requests.
- **Verification & Review**:
  - Horizontal scrollable **Verification Queue** showing submitter and group member chips with quick approve/reject controls.
  - Professor title review modal showing version reports, lock/unlock toggles, student project updates with deleted/edited flags, and feedback comments.
- **Tech-Stack Autocomplete**: Combobox tag input suggesting previously used tech tags within the same class/slot while allowing custom new tag additions.
- **Dark Mode & Theming**: Persisted dark mode preference across professor and student pages.
- **CSV export**: Client-side roster and slot data exports.

## Phase 14–18 behavior

- Titles require at least five characters after trimming in student and professor create/edit routes. Similarity checks use `pg_trgm` at 0.4 plus literal substring matching, scoped to the class and slot, excluding deleted titles and the edited title itself. Strict slots block; warn slots require confirmation showing the matching titles. Professor edits and verification use the same rules.
- Slot instructions are plain text, editable under Settings / Rules and displayed above the student tabs.
- Class settings include archive/restore and permanent deletion requiring the class name. Archived classes are hidden from the default professor list; select **Show archived classes** to restore them. Archiving preserves existing student access; it does not lock submissions.
- Student Board, professor progress board, and title review use TanStack Query. Cache keys separate roles, titles, classes and slots. Cached data remains visible during refreshes; unvisited projects show an initial loading state. Boards poll every ten seconds while visible, refetch stale data on focus, and retain unused cache for ten minutes. Task moves are optimistic and roll back on errors. Task/update mutations refresh only the affected title. Logging out to a login page clears the cache.
- Tech-stack inputs display class/slot-scoped combobox suggestions populated from existing title proposals ordered by frequency. Submissions normalize tag formatting and deduplicate entries.
- Pending title verification queue displays submitter details and groupmate chips for quick scanning on the professor dashboard.
- The professor update feed checks class ownership before reading activity. Professor audit history continues to include deleted tasks/updates; student feeds omit deleted activity.

For an existing database, apply these additive migrations if needed:

```bash
node scripts/apply-sql.mjs phase14_schema.sql
node scripts/apply-sql.mjs phase15_schema.sql
npm run db:health
```

The current configured database passed the read-only schema check on 2026-09-29; no migration or record deletion was needed during this review.

Validation:

```bash
npm run test:roadmap
npx tsc --noEmit
npm run build
```

`npm run test:board` runs isolated browser fixtures with Playwright and Microsoft Edge. See the review document for setup. Real-database click tests and production deployment remain separate release checks.

## What's not wired up yet (per "Open Decisions" in plan.md)

- OTP row cleanup (cron or on-login) — expired rows are just ignored by the `expires_at` check, not deleted
- GitHub commit tracking & background repo ping (`last_commit_sha`, `last_commit_at`)

## Folder structure

```
src/
├── app/
│   ├── page.tsx                          landing
│   ├── login/, login/verify/             prof OTP auth
│   ├── dashboard/                        prof: classes, slots, roster, board, verification
│   ├── c/[classId]/                      student: login, slot dashboard (4 tabs), verified list
│   └── api/                              all routes (auth, classes, student, dashboard, prof)
│       ├── student/updates/              student update logs (GET, POST, PATCH, DELETE)
│       ├── student/titles/[titleId]/     title CRUD, repo URLs, version reports
│       └── prof/updates/                 professor update history view
├── components/
│   ├── dashboard/                        prof components (progress board, title review, slot settings)
│   ├── student/                          student components (title card, group members, tech stack, progress)
│   └── ui/                               reusable UI components (buttons, cards, dialogs, tabs)
├── lib/
│   ├── db.ts                             Neon client (drizzle-orm/neon-http)
│   ├── schema.ts                         Drizzle tables mirroring database
│   ├── auth.ts                           JWT helpers (prof + student sessions)
│   ├── mailer.ts                         Nodemailer OTP email
│   ├── progress.ts                       Progress statuses & labels
│   └── project-updates.ts                Progress change logging helper
└── middleware.ts                         protects /dashboard/* and /c/[classId]/*
```
