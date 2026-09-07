# Project-Submissions — Task Checklist

> Restructured 2026-09-06: shipped v1.5 phases (1–7) collapsed into a summary
> below — full step-by-step detail for that work still exists in git history
> / the previous version of this file if ever needed. Everything currently
> open (schema reset, task-level PM, custom docs) is kept in full detail.

## ✅ Shipped — v1.5 Student Dashboard (Phases 1–7, summarized)
- [x] Schema: `project_updates.updated_at/deleted_at`, `title_reports.documentation` jsonb
- [x] Student API routes: updates CRUD (`GET/POST/PATCH/DELETE /api/student/updates`)
- [x] Prof API route: `GET /api/prof/updates` (includes soft-deleted, for audit)
- [x] Frontend: 4-tab `slot-dashboard.tsx` (`Titles`, `Submissions`, `Board`, `Group`) with smart default tab
- [x] `TitleCard`: edit-all-statuses, inline Progress Reports section, submit-report dialog
- [x] Board tab: kanban (title-level) + activity feed per title
- [x] Prof-side: read-only board/updates view, soft-deleted + edited badges in `TitleReviewDialog`
- [x] `npm run build` — zero type errors

---

## Phase 0 — Database Reset / Cleanup (completed)

> DB is still in testing, so this is a clean rebuild rather than incremental
> `ALTER`s. Source of truth: `schema.sql` (consolidated version below).

- [x] Audit existing schema for cruft
  - Found: entire `neon_auth` schema (`account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, `verification`) — unused Neon-template scaffolding, no app code references it (auth is fully custom: professor OTP+JWT, student ID+password+JWT)
  - Found: inconsistent `updated_at` coverage — `classes`, `groups`, `project_slots` were missing it while every other mutable table had it
  - Found: inconsistent soft-delete coverage — `title_reports` had no `deleted_at` despite `titles`/`project_updates`/`tasks` all following that pattern
  - Found: no composite index on `activity_log` for filtered lookups (needed for Phase 8's "stalled projects" query)
- [x] Write consolidated `schema.sql` — drops `neon_auth`, bakes in `tasks` + `documentation_field_templates` from the start, adds the missing `updated_at`/`deleted_at` columns, adds `idx_activity_class_action`
- [x] Drop old `public` schema on the Neon dev DB — done, DB is now empty (no `neon_auth` either, since it was never recreated)
- [x] Run `schema.sql` against the DB to recreate `public` from scratch — done
- [x] **Verify all tables/indexes/FKs came up clean** — `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` returned **17**, which is correct (professors, professor_otps, classes, students, project_slots, documentation_field_templates, groups, student_group_slots, group_invites, group_leave_requests, titles, tasks, title_reports, project_updates, feedback, activity_log, rate_limits). No `neon_auth` remnants.
- [x] Regenerate `src/lib/schema.ts` (Drizzle) to match exactly — complete mirror with all 17 tables and timestamp columns
- [x] Remove any leftover `neon_auth`/better-auth imports or config files from the codebase — verified clean
- [x] Update `.env.local.example` — created clean example with only the active JWT, Neon, and Gmail credentials

---

## Phase 8 — Task-Level Project Management (v1.7) (completed)

> Goal: move the Kanban board from tracking one card per *title* to tracking many cards per *task*.

### 8.1 — Schema
- [x] `tasks` table (baked into `schema.sql` directly — see Phase 0)
- [x] `task_id` FK on `project_updates`, `ON DELETE SET NULL`
- [x] Indexes: `idx_tasks_title_status`, `idx_tasks_assignee`, `idx_tasks_group`, `idx_tasks_deleted_at`, `idx_project_updates_task`
- [x] Mirror in `src/lib/schema.ts` (Drizzle) — tasks table with status, assignee, due_date, sort_order, timestamps

### 8.2 — API Routes (student side)
- [x] `GET /api/student/tasks?titleId=` — list tasks for a title (excludes soft-deleted, joins assignee)
- [x] `POST /api/student/tasks` — create a task (name, description, assignee, due_date, status)
- [x] `PATCH /api/student/tasks/[taskId]` — edit fields / move status → logs `task.status_changed` to `activity_log`
- [x] `DELETE /api/student/tasks/[taskId]` — soft-delete (sets `deleted_at`)
- [x] `GET /api/student/tasks/mine?groupId=` — "my tasks" view filtered by `assignee_student_id`

### 8.3 — API Routes (prof side)
- [x] `GET /api/prof/tasks?titleId=` — read-only list, including soft-deleted (audit view)
- [x] `GET /api/prof/tasks/stalled?classId=` — tasks with no status change in N days (default 7 days)

### 8.4 — Frontend: BoardTab restructure
- [x] Swap Kanban cards from title-cards to task-cards (title context via existing dropdown)
- [x] `TaskCard` — name, assignee, due date badge, overdue badge, status select, inline edit and delete
- [x] "Create Task" button per column + quick-add modal (`AddTaskDialog`)
- [x] "My Tasks" filter toggle
- [x] Overdue badge when `due_date < now()` and status != done

### 8.5 — Professor side
- [x] Read-only task board / view on prof class page
- [x] "Stalled projects" widget on prof dashboard (`StalledWidget`)
- [x] Task audit trail in `TitleReviewDialog`

### 8.6 — Cleanup
- [x] Run `npm run build` — confirm zero type errors

---

## Phase 9 — Custom Documentation Field Templates (v1.5.2) (completed)

> Goal: profs define their own documentation fields per slot instead of a fixed set.
> `title_reports.documentation` (jsonb) already supports arbitrary keys.

### 9.1 — Schema
- [x] `documentation_field_templates` table (baked into `schema.sql` directly)
- [x] FK → `project_slots(id)` `ON DELETE CASCADE`, unique `(slot_id, field_key)`, index on `(slot_id, sort_order)`
- [x] Decide + implement default seeding (Abstract / Statement of the Problem / Scope & Limitations / Key Objectives via "Seed standard academic fields" button)

### 9.2 — API Routes (prof side)
- [x] `GET /api/prof/slots/[slotId]/doc-fields` — list all doc field templates
- [x] `POST /api/prof/slots/[slotId]/doc-fields` — create doc field template
- [x] `PATCH /api/prof/slots/[slotId]/doc-fields/[fieldId]` — edit template
- [x] `DELETE /api/prof/slots/[slotId]/doc-fields/[fieldId]` — remove template

### 9.3 — API Routes (student side)
- [x] `GET /api/student/slots/[slotId]/doc-fields` — read-only list for rendering form
- [x] Extend `title_reports` POST/PATCH validation for `required` fields

### 9.4 — Frontend: Prof slot settings
- [x] "Documentation Fields" editor in `SlotSettingsPanel` — add/edit/remove, type + required toggle
- [x] "Seed standard academic fields" shortcut button

### 9.5 — Frontend: Student Structured Docs Builder
- [x] Dynamic form from field templates in `TitleCard` report modal, writing into `title_reports.documentation`
- [x] Required-field indicator + submission validation

### 9.6 — Frontend: Prof document review
- [x] `TitleReviewDialog` renders `label: value` per template and structured documentation details

### 9.7 — Cleanup
- [x] Run `npm run build` — confirm zero type errors
---

## Phase 10 — Post-Ship Schema Drift Audit (2026-09-07)

> Re-checked the repo against the applied `schema.sql` after Phase 8/9 shipped.
> Both features were built and are real (verified routes, components, and
> CHANGELOG entries exist), but two columns/constraints that the code needs
> were never added to the database during the Phase 0 reset.

- [x] Audit `schema.ts` + API routes against the live schema
  - Found: `tasks.sort_order` is read/written by every task API route (`GET/POST/PATCH` in `src/app/api/student/tasks/*` and `src/app/api/prof/tasks/*`) but was never in `schema.sql` — every task query is likely failing with `column "sort_order" does not exist`
  - Found: `documentation_field_templates_field_type_check` only allows `text`/`textarea`, but `src/app/api/prof/slots/[slotId]/doc-fields/route.ts` validates and accepts `text`/`textarea`/`url`/`date` — creating a `url` or `date` field will pass app validation then fail the DB CHECK constraint
  - Found: `scripts/schema-health.mjs` didn't check `tasks.sort_order`, so it wouldn't have caught the first issue even if run
- [x] Write `fix_schema_drift.sql` — adds `tasks.sort_order`, widens the `field_type` CHECK constraint
- [x] Update `scripts/schema-health.mjs` to also check `tasks.sort_order`
- [x] Run `fix_schema_drift.sql` against the dev DB — `sort_order` added, `field_type` CHECK widened to `text/textarea/url/date`
- [x] Run `node scripts/schema-health.mjs` to confirm clean — all 17 tables + key columns verified, `tasks.sort_order` present
- [ ] Manually test: drag a task card between columns (exercises `sort_order`), and add a `url`-type or `date`-type documentation field (exercises the widened CHECK)

---

## Phase 11 — Documentation/Report/Update UX Split (2026-09-07) (completed)

> Screenshots of the live report modal (Image 2) showed the real problem: a
> student logging a routine progress update was being forced to also fill
> out Abstract / Statement of the Problem / Key Objectives — fields that
> describe the whole project, not one version. Confirmed direction: docs
> are per-title (persistent), reports stay lightweight, and the Board's
> updates need real commit/changelog support since that's the actual
> "pass along updates" mechanism.

### 11.1 — Schema
- [x] `ALTER TABLE titles ADD COLUMN documentation jsonb` — persistent per-title doc
- [x] `ALTER TABLE title_reports DROP COLUMN documentation` — no longer per-version
- [x] `ALTER TABLE project_updates ADD COLUMN changelog text` — lets a quick update carry a short "what changed" list
- [x] Run `phase11_schema.sql`, then `node scripts/schema-health.mjs` (add `titles.documentation`, `project_updates.changelog` to its checks; remove `title_reports.documentation` from them)

### 11.2 — API routes
- [x] `PATCH /api/student/titles/[titleId]` — accept `documentation` updates independent of report submission
- [x] `POST /api/student/titles/[titleId]/documentation` (or fold into the PATCH above) — save persistent doc fields
  - **No hard validation block.** For every `field_key` in that slot's `documentation_field_templates`, write the submitted value, or `null` if the student left it blank — every defined key is always present in the jsonb (never just omitted), so a prof reviewing later can tell "left blank" apart from "this field doesn't exist for this slot"
  - Response includes a `missingRequiredCount` (or list of missing required `field_key`s) so the frontend can show the indicator without recomputing it client-side
- [x] `title_reports` POST/PATCH — remove the `documentation` validation entirely; reports become version tag + summary + changelog + optional repo/deploy override only
- [x] `POST /api/student/updates` — accept optional `changelog`, `commitSha`, `commitUrl` alongside existing `headline`/`body`/`kind`; allow `kind: 'commit'`

### 11.3 — Frontend: title-card.tsx
- [x] New **"Project Documentation"** section (separate from "Progress Reports") — dynamic form from `documentation_field_templates`, own save action, persistent across reports
- [x] Remove the `required` attribute from doc-field inputs — save button always works, no browser-level block
- [x] Slim the **"Submit Report"** dialog — remove the entire Documentation Deliverables block; keep version/summary/changelog/repo/deploy only
- [x] Show "Documentation: complete" or "N field(s) missing" indicator near the panel, driven by the API's `missingRequiredCount` — informational only, never blocks saving

### 11.4 — Frontend: Board "Add update" (slot-dashboard.tsx)
- [x] Add `commit` as a selectable `kind` (dropdown currently only has progress/milestone/note despite the DB always allowing `commit`)
- [x] When `kind === 'commit'`: show optional Commit SHA + Commit URL fields
- [x] Add optional **Changelog** textarea (maps to the new `project_updates.changelog`), available for any kind, not just commit

### 11.5 — Prof review (TitleReviewDialog)
- [x] Render the title-level Project Documentation as its own section, separate from the version reports list
- [x] Render `null` values as "Not yet filled" (muted text) rather than blank — makes incomplete fields visible to the prof, not just the student
- [x] Version reports list stays as-is but without documentation fields attached

### 11.6 — Cleanup
- [x] Run `npm run build` — confirm zero type errors
- [ ] Manual test: submit a quick progress report without touching documentation at all; separately edit the Project Documentation panel and confirm it doesn't require a new report to save

