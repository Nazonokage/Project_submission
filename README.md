# Project-Submissions

Next.js 14 + Neon PostgreSQL app for professors to manage student project title
submissions, verification, grouping, and repo tracking — no student accounts required.

Built to match `plan.md` and `TODO.md`. This build has been compiled and
type-checked successfully (`npm run build`) against a dummy `.env.local`.

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

Your Neon DB already has all 9 tables from `schema.sql` (professors,
professor_otps, classes, project_slots, students, groups, student_group_slots,
group_invites, titles, activity_log). If you're starting fresh, run
`schema.sql` in the Neon SQL editor. `drizzle.config.ts` is set up so you can
also manage migrations with `npm run db:generate` / `npm run db:push` going
forward — the schema in `src/lib/schema.ts` mirrors `schema.sql` exactly.

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
  - Prof queue filterable by status, approve/reject with rejection reason feedback.
  - Professor title review modal showing version reports, lock/unlock toggles, student project updates with deleted/edited flags, and feedback comments.
- **Dark Mode & Theming**: Persisted dark mode preference across professor and student pages.
- **CSV export**: Client-side roster and slot data exports.

## What's not wired up yet (per "Open Decisions" in plan.md)

- Fuzzy duplicate matching (`pg_trgm`) — currently plain `ILIKE`
- Tech-stack autocomplete from previously-used class tags — currently free-text tags
- OTP row cleanup (cron or on-login) — expired rows are just ignored by the `expires_at` check, not deleted
- GitHub commit tracking & background repo ping (`last_commit_sha`, `last_commit_at`)
- Student drag-and-drop Kanban (currently uses column select dropdown)

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
