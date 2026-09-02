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
  when full; "students without a group" list
- **Titles**: submission with live ILIKE duplicate check, strict/warn modes,
  required-field enforcement per slot, editing (any group member, resets to
  pending on edit), prof direct-add with optional auto-verify
- **Verification**: prof queue filterable by status, approve/reject, activity log
- **Repo tracking**: repo/deployment URL submission unlocked after verification
- **Verified titles view**: searchable across title/description/tech stack/target users
- **CSV export**: client-side via a Blob download (roster); titles export can be
  added the same way if you want it wired into the verification queue too

## What's not wired up yet (per "Open Decisions" in plan.md — your call)

- Fuzzy duplicate matching (`pg_trgm`) — currently plain `ILIKE`
- Tech-stack autocomplete from previously-used class tags — currently free-text tags
- OTP row cleanup (cron or on-login) — expired rows are just ignored by the `expires_at` check, not deleted
- GitHub last-commit ping for `repo_last_checked`
- Titles CSV export button (roster export is done; titles export is the same pattern)

## Folder structure

```
src/
├── app/
│   ├── page.tsx                          landing
│   ├── login/, login/verify/             prof OTP auth
│   ├── dashboard/                        prof: classes, slots, roster, verification
│   ├── c/[classId]/                      student: login, slot dashboard, verified list
│   └── api/                              all routes (auth, classes, student, dashboard)
├── lib/
│   ├── db.ts          Neon client (drizzle-orm/neon-http)
│   ├── schema.ts       Drizzle tables mirroring schema.sql
│   ├── auth.ts         JWT helpers (prof + student sessions)
│   ├── mailer.ts        Nodemailer OTP email
│   └── helpers.ts        OTP/password generation, ownership checks
└── middleware.ts         protects /dashboard/* and /c/[classId]/*
```
