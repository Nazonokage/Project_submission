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
- Convert the student title submission flow to a modal-based UX
- Default the student verified tab to the first visible view
- Final notebook-style visual polish
- Future v1.5 ideas such as GitHub commit tracking and student drag-and-drop board improvements