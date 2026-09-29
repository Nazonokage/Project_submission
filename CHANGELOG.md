## [1.7.3] - 2026-09-29

### Phase 18 — Verification Queue UX & Groupmates
- Added horizontal scrollable verification queue card list (`VerificationQueue`) for pending title reviews on the professor class dashboard.
- Display submitter identity and group member chips for each proposed project title.
- Quick Approve and Reject actions with optional rejection feedback comments directly from queue cards or full detail dialog.

## [1.7.2] - 2026-09-29

### Phase 17 — Tech-stack Autocomplete
- Added slot and class-scoped tech tag suggestion APIs (`GET /api/student/slots/[slotId]/tech-tags` and `GET /api/prof/slots/[slotId]/tech-tags`).
- Extracted unique tech stack tags from existing slot proposals ordered by usage frequency, excluding soft-deleted titles.
- Upgraded `TechStackInput` component with a combobox suggesting previously used tags while preserving custom free-text tag additions.
- Added tech stack string array normalization and case-insensitive deduplication helpers (`src/lib/tech-stack.ts`) across student and professor title edit routes.

## [1.7.1] - 2026-09-29

### Phase 16 — Cached live boards
- Added a persistent TanStack Query provider, role/title/class/slot query keys, 20-second stale time, ten-minute unused cache, and one query retry.
- Student tasks, activity and feedback; professor project lists; and title-review details refresh every ten seconds while visible. Cached content stays visible during background refreshes and tab/project switches.
- Task create/edit/delete and project-update create/edit/delete use mutations. Task status moves update optimistically with cancellation, rollback, and title-scoped invalidation. No full-dashboard reload follows board writes.
- Kept existing professor audit history and student soft-delete filtering. Fixed missing class ownership enforcement on the professor activity endpoint.
- Widened the student Board tab and wrapped task controls after browser checks found overlapping buttons.
- Added route regression checks and isolated browser tests; see `docs/phase14-16-review.md` for coverage and deferred live checks.
- Existing dependency audit findings are tracked separately; no forced major dependency upgrades in this release.

## [1.7.1a] - 2026-09-29

### Phase 15 — Instructions and class lifecycle
- Added nullable slot instructions and class archive timestamp, additive migrations, Drizzle declarations and schema checks.
- Professors can edit slot instructions; students see them above their slot tabs.
- Added archive/restore controls, an archived-class filter, and a name-confirmation dialog for permanent cascading deletion.
- Hardened instruction updates and delete confirmation against malformed payloads. Archive preserves student access and class data.

## [1.7.0] - 2026-09-29

### Phase 14 — Validation review and fixes
- Enforced five trimmed characters for title creation and edits, including professor routes.
- Centralized trigram similarity (0.4) and literal substring checks, excluding soft-deleted titles and the edited title. Registered the GIN index in Drizzle and verified its definition in schema health.
- Closed the student-edit duplicate bypass and added matching checks to professor edits/verification. Warn mode now requires explicit confirmation of server-returned matches; strict mode remains blocking.
- Removed deleted titles from the submission-cap count; cancelled stale preview requests and fixed the missing slot-instructions icon import.

## [1.6.3] - 2026-09-22

### Added
- **Class default student password**: Each class now stores `default_student_password` (starts as `2026`). Professors can change it from the roster; new and imported students inherit it instead of a random password.
- **Sequential roster IDs**: Adding a student only requires a name. IDs continue from the highest numeric ID in the class (`0001`, `0002`, …), including imports into a non-empty roster.
- **Professor student profile**: `/dashboard/[classId]/students/[studentId]` shows credentials, groups, titles, leave requests, and edit/delete actions.
- **Student My account**: `/c/[classId]/me` with `GET/PATCH /api/student/me` so students can view their identity and change their own password (current password required; name/ID stay professor-owned).

### Changed
- **Roster UX**: Table rows are read-only summaries (group status, last login). Edit opens a modal that saves with a single PATCH.
- **Student login**: Successful login now stamps `lastLoginAt` for roster and profile display.

---

## [1.6.2] - 2026-09-07

### Added & Changed
- **Unified Progress Reporting & Board Visibility (Phase 12)**:
  - **Single progress entry point**: Added `ProgressReportModal`, shared by the Board and verified-title card. Students can choose a Quick Update or a formal Milestone / Version Report without duplicate forms.
  - **Linked milestone records**: Formal reports now create a matching `project_updates` milestone inside one database transaction, linked through `title_reports.project_update_id`.
  - **Project-aware student Board**: The active project is prominently identified above its Kanban and activity feed; the logging action is explicitly scoped to that project.
  - **Richer activity feed**: Milestones show their version-report badge and linked report summary, changelog, and project links. Open professor feedback is visible alongside the student activity feed.
  - **Professor latest-report view**: Project-board cards show the latest report and open a detail dialog with its summary, changelog, and submitted links.
  - **Schema health coverage**: Added a migration and health check for `title_reports.project_update_id`.

---

## [1.6.1] - 2026-09-07

### Added & Changed
- **Documentation / Report / Update UX Split (Phase 11)**:
  - **Persistent Project Documentation**: Decoupled deliverables (Abstract, Problem Statement, Scope, etc.) from version reports, saving them directly at the title level (`titles.documentation`).
  - **Lightweight Version Reports**: Progress reports now focus strictly on version milestones, changelogs, summaries, and deployment links (`title_reports`).
  - **Informational Completion Badges**: Real-time status badge showing "Documentation: complete" or "N field(s) missing" without blocking partial saves.
  - **Commit & Changelog Support on Board**: Added `commit` kind to project updates feed with optional Commit SHA, Commit URL, and Changelog textarea.
  - **Professor Structured Documentation Review**: `TitleReviewDialog` now renders persistent Project Documentation in its own dedicated section with explicit "Not yet filled" indicators for incomplete fields.

---

## [1.7.0] - 2026-09-07

### Added
- **Task-Level Kanban Project Management**: Transformed the student Board tab from title-level tracking to fine-grained task management (`Planning`, `In Progress`, `Review`, `Done`)
- **Interactive HTML5 Drag-and-Drop**: Drag task cards directly between Kanban columns with real-time drop indicator styling and status transitions
- **TaskCard Component**: Interactive task item card displaying assignees, due dates, overdue badges, inline editing, and deletion
- **My Tasks Filter**: Toggle on the Kanban board to view personal assignments
- **Quick-Add Task Modal**: Direct task creation per column with assignee selector and due date input
- **Professor Stalled Tasks Widget**: Automatic detection of tasks with no activity in 7+ days on the professor dashboard
- **Professor Task Audit Trail**: Full task audit history including soft-deleted items in `TitleReviewDialog`
- **Task API Endpoints**:
  - `GET /api/student/tasks?titleId=` & `POST /api/student/tasks`
  - `PATCH /api/student/tasks/[taskId]` & `DELETE /api/student/tasks/[taskId]`
  - `GET /api/student/tasks/mine?groupId=`
  - `GET /api/prof/tasks?titleId=`
  - `GET /api/prof/tasks/stalled?classId=`

---

## [1.5.2] - 2026-09-07

### Added
- **Custom Documentation Field Templates**: Professor configuration of custom deliverables per slot (e.g. Abstract, Problem Statement, Scope, Objectives)
- **Automatic Default Seeding**: Automatically populates 4 standard academic deliverables (*Abstract*, *Statement of the Problem*, *Scope & Limitations*, *Key Objectives*) upon slot creation
- **Standard Academic Fields Seeder**: One-click default re-seeding in slot settings
- **Dynamic Student Docs Builder**: Form generated dynamically from slot templates during progress report submission
- **Required Fields Enforcement**: Automatic validation preventing report submission when required deliverables are missing
- **Structured Report Review**: Template-aware field rendering in `TitleReviewDialog`
- **Doc Fields API Endpoints**:
  - `GET /api/prof/slots/[slotId]/doc-fields` & `POST /api/prof/slots/[slotId]/doc-fields`
  - `PATCH /api/prof/slots/[slotId]/doc-fields/[fieldId]` & `DELETE /api/prof/slots/[slotId]/doc-fields/[fieldId]`
  - `GET /api/student/slots/[slotId]/doc-fields`
- **Database & Drizzle Synchronization**: Updated Drizzle schema (`src/lib/schema.ts`) to mirror the consolidated 17 public tables in Neon

---

## [1.5.0] - 2026-09-06

### Added
- 4-tab student slot dashboard: `Titles` (class-wide browse), `Submissions` (group project management), `Board` (Kanban workflow), and `My Group`
- Smart default tab navigation: defaults to `Titles` for ideation, auto-switches to `Submissions` when a verified title exists
- Student Title Submission modal: converts the title submit form into a modal dialog once the group has 1+ verified titles to keep the focus on the active project
- Full editing permissions on verified titles: students can edit title text, description, tech stack, and target users post-verification
- Student Kanban Board with 4 workflow stages (`Planning`, `In Progress`, `Review`, `Done`) and multi-title dropdown selector
- Project Updates activity feed per verified title (`progress`, `milestone`, `note`) with edit and soft-delete capabilities (`updated_at`, `deleted_at`)
- Inline Progress Reports section on verified title cards (showing latest reports + expandable list + modal submission form)
- Structured `documentation` JSONB column support on `title_reports` for academic deliverables (abstract, statement of problem, etc.)
- Professor visibility into student project updates, including edited timestamps and soft-deleted update indicators in `TitleReviewDialog`

### Changed
- Reorganized student slot dashboard from a monolithic form into a streamlined 4-tab workflow
- Allowed rejected titles to automatically reset to `pending` upon student revision
- Updated `TitleReviewDialog` to show the full audit trail of progress reports, student updates, and professor feedback

---

## [1.4.0] - 2026-09-04

### Added
- OTP rate limiting with a 5-attempt-per-15-minute cap
- Action rate limiting for title and report submissions via `rate_limits`
- Dark mode support with persistent theme storage in `localStorage`
- Professor board-first class view with tab routing and student highlight navigation
- Version reports / progress report flow for verified titles
- Professor and PM feedback system for titles and reports
- CSV export for class slot progress data
- Improved title management controls for professor review and verification

### Changed
- Updated the professor dashboard to use the Board tab as the default entry point
- Added stronger reporting and feedback support across title review flows
- Refreshed the project checklist to match the actual implemented state

### Fixed
- Clarified the project status by aligning the docs and task list with the working codebase

### Still Pending
- Final notebook-style visual polish
- Future v1.5+ ideas such as GitHub commit tracking and student drag-and-drop board improvements
