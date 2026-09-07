# Project-Submissions — Roadmap

**Current Version: v1.7 (Shipped: Task-Level PM & Custom Doc Field Templates)**
Last updated: 2026-09-07

---

## ✅ Shipped Features

### v1.7: Task-Level Project Management (Phase 8)
- **Task-Level Kanban Board**: Multi-task work item board (`Planning` / `In Progress` / `Review` / `Done`) with title context selector
- **Interactive HTML5 Drag-and-Drop**: Real-time drag-and-drop task card reassignment across Kanban columns
- **TaskCard Component**: Name, description, assignee badge, due date badge with overdue indicators, status transition, inline edit & delete
- **Task Filtering**: "My Tasks" toggle filter for group members
- **Quick-Add Modal**: Add tasks per column with assignee and due date
- **Professor Stalled Widget**: Stalled tasks dashboard widget identifying inactive work items (>7 days)
- **Task Audit Trail**: Read-only tasks & status history in `TitleReviewDialog`
- **Student & Prof Task APIs**: Full CRUD (`/api/student/tasks`, `/api/student/tasks/mine`, `/api/prof/tasks`, `/api/prof/tasks/stalled`)

### v1.5.2: Custom Documentation Field Templates (Phase 9)
- **Doc Fields Manager**: Slot-level template configuration (label, slug key, field type: text/textarea/url/date, required toggle)
- **Standard Academic Fields Seeder**: Automatic slot creation seeding + one-click manual re-seeding of standard academic fields (Abstract, Statement of the Problem, Scope & Limitations, Key Objectives)
- **Student Structured Docs Builder**: Dynamic form generation from slot templates in report submission modal
- **Required Fields Enforcement**: Automatic validation preventing report submission when required deliverables are missing
- **Professor Doc Review**: Template-aware structured rendering in `TitleReviewDialog`

### Phase 0: Clean Database & Drizzle Schema Sync
- Consolidated 17 public PostgreSQL tables in Neon
- Full Drizzle schema synchronization in `src/lib/schema.ts`
- Automated schema health verification script (`scripts/schema-health.mjs`)
- Clean `.env.local.example`

### v1.5: Student Dashboard & Version Reports
- 4-Tab Student Dashboard (`Titles`, `Submissions`, `Board`, `My Group`)
- Project updates activity feed with milestone and progress logging
- Inline progress report submission and lock/unlock moderation

---

## 🎯 Next Up

### Sprint 1: Real-time & Board Polish (v1.7.1)
- Live board updates via SSE / polling
- Mobile responsive & touch drag-and-drop pass for task columns

### Sprint 2: GitHub & Automation (v1.8)
- GitHub commit auto-sync into task / project updates feed
- Automated commit cards on Kanban
- Fuzzy duplicate detection (`pg_trgm`)
- Tech-stack autocomplete across classes

### Polish & Maintenance
- Notebook/doodle aesthetic pass
- Term-based class archiving & historical exports
---

## ✅ Schema Drift Audit (2026-09-07) — Resolved

Re-checked the repo after v1.7/v1.5.2 shipped — both features were real and working code,
but the DB was missing two things the code needed:
- `tasks.sort_order` (drag-and-drop ordering) — added
- `documentation_field_templates.field_type` CHECK constraint — widened to `text/textarea/url/date`

Fix applied via `fix_schema_drift.sql`, verified clean with `npm run db:health`.
Only remaining step: manual click-test of drag-and-drop + a `url`/`date` doc field.
*(Detail: `task.md` → "Phase 10")*
