# Project-Submissions — TODO & Roadmap

**Current Version: v1.5 (Shipped)**  
**Next Target: v1.5.1 / v1.6**  
Last updated: 2026-09-06

---

## ✅ Shipped in v1.5

- [x] **4-Tab Student Dashboard**: Restructured into `Titles`, `Submissions`, `Board`, `My Group`
- [x] **Smart Tab Routing**: Defaults to `Titles` for ideation, auto-switches to `Submissions` when title is verified
- [x] **Modal Title Submission**: Converts submit form into a modal dialog once group has 1+ verified titles
- [x] **Full Verified Editing**: Allowed students to edit title text, description, tech stack, and target users post-verification
- [x] **Student Kanban Board**: 4 progress columns (`Planning`, `In Progress`, `Review`, `Done`) with multi-title selector
- [x] **Project Updates Activity Feed**: Student log entries (`progress`, `milestone`, `note`) with edit and soft-delete support
- [x] **Inline Progress Reports**: Displayed on verified title cards with modal submission dialog
- [x] **Database Schema Additions**: `project_updates.updated_at`, `project_updates.deleted_at`, `title_reports.documentation` (JSONB)
- [x] **Professor Audit Trail**: `TitleReviewDialog` displays student project updates, edit timestamps, and soft-deleted flags
- [x] **React Hydration Fix**: Resolved SSR/client mismatch on student login link generation in `ClassPage` (`dashboard/[classId]`)

---

## 🎯 Next Tasks (Upcoming Sprints)

### Sprint 1: Kanban & Updates Polish (v1.5.1)
- [ ] **Live Snippets on Kanban Cards**: Show update counts (`💬 3 updates`) and latest update preview directly on cards (both student & prof boards)
- [ ] **Drag-and-Drop Interaction**: Native pointer/HTML5 drag-and-drop for Kanban columns on both boards
- [ ] **Real-time Refresh / Polling**: Auto-refresh updates feed on board transitions without manual reload

### Sprint 2: Academic Documentation UI (v1.5.2)
- [ ] **Structured Docs Builder**: Interactive form inside progress reports for JSONB fields:
  - Abstract
  - Statement of the Problem
  - Scope & Limitations
  - Key Objectives & Deliverables
- [ ] **Professor Document Review**: Dedicated document viewing pane in `TitleReviewDialog`

### Sprint 3: GitHub & Automation (v1.6)
- [ ] **GitHub Commit Auto-Sync**: Background ping to fetch latest commits from public/private repos into the updates feed
- [ ] **Commit Cards**: Show commit SHA, author, message, and branch badge on Kanban cards
- [ ] **Fuzzy Duplicate Detection**: Integrate `pg_trgm` similarity check on title submissions
- [ ] **Tech-Stack Autocomplete**: Curate suggestions based on tags previously used in the class

### Polish & Maintenance
- [ ] **Notebook / Doodle Aesthetic**: Refine paper styling, hand-drawn badges, pencil borders, and sketch empty states
- [ ] **Mobile Responsive Pass**: Optimized Kanban board horizontal scrolling and drawer panels on mobile devices
- [ ] **Archive & History**: Class archiving and term-based historical viewing