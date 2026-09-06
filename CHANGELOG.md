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