# Project-Submissions — Task Checklist

> Restructured 2026-09-06: shipped v1.5 phases (1–7) collapsed into a summary.
> Everything currently open is kept in full detail.

## ✅ Shipped — v1.5 Student Dashboard (Phases 1–7, summarized)
- [x] Schema: `project_updates.updated_at/deleted_at`, `title_reports.documentation` jsonb (later moved)
- [x] Student API routes: updates CRUD
- [x] Prof API route: `GET /api/prof/updates`
- [x] Frontend: 4-tab `slot-dashboard.tsx`
- [x] `TitleCard`: edit-all-statuses, inline Progress Reports section
- [x] Board tab: kanban + activity feed
- [x] Prof-side: read-only board/updates view
- [x] `npm run build` — zero type errors

---

## Phase 0 — Database Reset / Cleanup (completed)
- [x] Full clean rebuild of public schema (17 tables)
- [x] Drizzle schema fully mirrored
- [x] Schema health script

---

## Phase 8 — Task-Level Project Management (v1.6.1 / v1.7) (completed)
- [x] `tasks` table + indexes
- [x] Student + Prof task APIs (CRUD + stalled)
- [x] BoardTab restructured to task cards + drag-and-drop
- [x] Professor stalled widget + audit trail
- [x] `npm run build` clean

---

## Phase 9 — Custom Documentation Field Templates (v1.5.2) (completed)
- [x] `documentation_field_templates` table
- [x] Prof + Student doc-field APIs
- [x] Dynamic form in TitleCard
- [x] Professor structured review
- [x] `npm run build` clean

---

## Phase 10 — Post-Ship Schema Drift Audit (2026-09-07) (completed)
- [x] Added `tasks.sort_order`
- [x] Widened `field_type` CHECK constraint
- [x] Updated schema-health script
- [ ] Manual click-test still recommended (drag-and-drop + url/date field)

---

## Phase 11 — Documentation/Report/Update UX Split (2026-09-07) (completed)
- [x] Persistent documentation moved to `titles.documentation` (jsonb)
- [x] `title_reports` no longer carries documentation
- [x] `project_updates.changelog` added
- [x] TitleCard split: Project Documentation panel vs slim Report modal
- [x] Board "Add update" supports `commit` kind + changelog
- [x] Professor review updated accordingly

---

## Phase 12 — Unified Progress Reporting & Board Visibility (v1.6.2) (completed; manual click-test remains)

> Goal: Students have one clear way to log progress. Formal version reports and Board activity are linked. Reports + professor feedback become visible on the Board.

### 12.1 — Schema
- [x] `ALTER TABLE title_reports ADD COLUMN project_update_id uuid REFERENCES project_updates(id) ON DELETE SET NULL`
- [x] Index on `title_reports.project_update_id`
- [x] Update `src/lib/schema.ts` (Drizzle) to include the new column
- [x] Update `scripts/schema-health.mjs` if needed
- [x] Neon schema already includes the column (idempotent migration retained in `phase12_schema.sql`)
- [x] Verify with `node scripts/schema-health.mjs`

### 12.2 — Shared Modal Component
- [x] Extract / create `ProgressReportModal` (or equivalent) that supports two modes:
  - **Quick update** → only writes `project_updates` (kind: progress / note / commit)
  - **Milestone / Version Report** → writes both `title_reports` + `project_updates` (kind: milestone) and links them via `project_update_id`
- [x] Mode selector (radio or toggle) at the top of the modal
- [x] Milestone mode shows: Version / Milestone Tag, Progress Summary, Changelog, optional Repo URL, optional Deployment URL
- [x] Quick mode shows: Type (progress/note/commit), Headline, Body, optional Changelog, optional Commit SHA/URL

### 12.3 — API Changes
- [x] `POST /api/student/titles/[titleId]/reports`
  - After inserting into `title_reports`, also insert a `project_updates` row (`kind = 'milestone'`)
  - Set `title_reports.project_update_id` to the new update id
  - Headline derived from version or "Progress Report"
  - Body = progress_summary, changelog copied
- [x] Ensure Board update GET endpoints can return linked report data when present
- [ ] (Optional) When a still-editable report is edited, keep the linked update in sync or leave an "edited" note

### 12.4 — Frontend Wiring
- [x] Board tab: project-scoped primary button opens shared modal (defaults to Quick)
- [x] Title card: "Submit Progress Report" opens the same modal pre-set to Milestone mode
- [x] No duplicate form logic — both entry points use the shared component

### 12.5 — Board Visibility
- [x] Activity feed renders milestone updates with a clear badge ("Version Report · v1.2")
- [x] Expanding a milestone update shows linked formal report details (version, summary, changelog, repo/deploy)
- [x] Surface recent open professor feedbacks (from `feedback` table) on the Board feed
- [x] Latest report preview and detail modal on the professor project board

### 12.6 — Professor side (light)
- [x] `TitleReviewDialog` continues to show formal reports; linked Board activity is surfaced
- [x] Open feedbacks already visible in review; they also appear on the student Board

### 12.7 — Cleanup
- [x] `npm run build` — zero type errors
- [ ] Manual test checklist:
  - [ ] Submit a Quick update from Board → only appears in activity feed
  - [ ] Submit a Milestone Report from Board or Title card → appears in both `title_reports` list and Board feed, linked
  - [ ] Professor feedback appears on Board
  - [ ] Editing / soft-deleting behaviour is sensible

---

## Notes / Open Decisions (Phase 12)
- Keep formal `title_reports` and lightweight `project_updates` as separate tables (different responsibilities)
- Linking via `project_update_id` is the bridge
- Shared modal is the key to making the UX feel like one system
- Future pure Option B (single modal everywhere) is still possible later if desired
