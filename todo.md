# Project-Submissions — Roadmap

**Current Version: v1.6.2**  
**Next Target: v1.7.1 — Live Board Updates**  
Last updated: 2026-09-07

---

## ✅ Shipped Features

### v1.6.2: Unified Progress Reporting & Board Visibility (Phase 12)
- **One Progress / Report Modal**: A single project-scoped dialog for both Quick Updates and formal Milestone / Version Reports.
- **Linked Reports and Activity**: Milestone reports automatically create a linked Board activity record, making formal submissions visible in both views.
- **Project-Scoped Student Board**: The active project is clearly identified above its task board and activity feed, preventing updates from being posted to the wrong project.
- **Board Feedback Visibility**: Open professor feedback is shown directly on the relevant student project Board.
- **Professor Latest-Report Modal**: Professor Board cards display the latest report, with a detailed modal for its summary, changelog, and links.

### v1.6.1 / v1.7: Task-Level Project Management (Phase 8)
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
- **Standard Academic Fields Seeder**: Automatic slot creation seeding + one-click manual re-seeding of standard academic fields
- **Student Structured Docs Builder**: Dynamic form generation from slot templates
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

### Later
- Live board updates via SSE / polling (v1.7.1)
- GitHub commit auto-sync (v1.8)
- Fuzzy duplicate detection (`pg_trgm`)
- Tech-stack autocomplete
- Notebook/doodle aesthetic pass
- Term-based class archiving

---

## ✅ Schema Drift Audit (2026-09-07) — Resolved
- `tasks.sort_order` added
- `documentation_field_templates.field_type` CHECK widened to `text/textarea/url/date`
- Verified clean with `npm run db:health`
