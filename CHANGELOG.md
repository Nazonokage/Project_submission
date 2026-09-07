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