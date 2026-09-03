# Project-Submissions — TODO

Last updated: 2026-09-03

---

## Legend
- [ ] Pending
- [x] Done
- [~] In progress / partially done
- 🔥 High priority
- 🟡 Medium
- 🟢 Low / Nice-to-have

---

## 1. Database & Schema Stability 🔥

- [x] Base schema (`schema.sql`) exists
- [x] Run `add_pm_schema.sql` on Neon
  - [x] Confirm these exist: `progress_status`, `last_commit_sha`, `last_commit_message`, `last_commit_at`
  - [x] Confirm tables exist: `group_leave_requests`, `project_updates`
  - [x] Verify no more `42703` or `42P01` errors
- [ ] Decide long-term approach:
  - Option A: Keep using raw SQL migration files
  - Option B: Fully switch to Drizzle (`db:generate` + `db:push`)
- [x] Schema health-check script (`npm run db:health`)

---

## 2. Critical Bug Fixes 🔥

- [x] Titles list endpoint no longer returns 500
- [x] Leave requests load without errors
- [x] Friendly warning in UI if leave-requests table is missing

---

## 3. UX Improvements

### 3.1 Term Auto-fill
- [x] Auto-fill term when creating a class
- [x] Manual edit + common presets still available

### 3.2 Student Login Experience
- [x] Searchable combobox (name or ID number)
- [x] Auto-fill ID Number + focus password
- [x] Optional quick-pick / recently used list

### 3.3 Professor Project Rule Configuration
- [x] Clean settings panel per project slot
- [x] Class-level default rules that new slots inherit

---

## 4. Doodle Theme 🎨

- [x] Apply new color palette
- [x] Update `globals.css` + `tailwind.config.ts`
- [x] Softer borders + larger border-radius
- [ ] Optional later: subtle paper texture

---

## 5. Project Management Features

### 5.1 Progress Status
- [x] Show `progress_status` in UI
- [x] Students + professors can update status
- [x] Log changes in activity / project_updates

### 5.2 Leave Requests
- [x] Student can request to leave a group
- [x] Professor can approve / decline
- [x] Pending list on class dashboard

### 5.3 Project Updates / Reports
- [x] Basic progress notes on status change
- [ ] **Student Reports (after verification)** 🔥
  - Students can submit structured reports once title is verified
  - Fields ideas (inspired by your spreadsheet):
    - GitHub / Repo URL
    - Deployment / Live URL
    - Version / Changelog notes
    - Progress summary / what was done
    - Screenshots or extra links (optional)
  - Students can edit their own reports (if professor allows it)
- [ ] Professor can view all reports cleanly

---

## 6. Professor Title Controls 🔥

- [x] Professor can **edit** any title (text, description, tech stack, target users, status, progress, etc.)
- [x] Professor can **delete** a title (with confirmation)
- [x] Optional: soft-delete vs hard-delete decision
  - Hard-delete for now (cascade progress notes). Soft-delete can wait until archive exists.
- [x] Log edit/delete actions in activity_log

---

## 7. Export System (Spreadsheet-inspired) 🔥

Goal: Let professors export something useful like the Activities.xlsx you showed, but adapted for **groups**.

- [ ] Export options on class / slot level:
  - CSV / Excel download
  - Columns ideas (group-aware):
    - Group Name / Group ID
    - Member names + Student IDs
    - Title
    - Status (pending / verified / rejected)
    - Progress Status
    - Repo URL
    - Deployment URL
    - Latest Report / Version notes
    - Submitted At / Last Updated
    - Verified At
- [ ] Support both:
  - Flat list (one row per title)
  - Grouped view (one row per group with members listed)
- [ ] Filter before export (by slot, status, progress, etc.)
- [ ] Nice filename: `ClassName_SlotLabel_YYYY-MM-DD.xlsx`

---

## 8. Kanban Board

- [x] Board view using `progress_status` (professor side)
- [x] Cards show title + group members
- [x] Status dropdown
- [ ] Student board view
- [ ] Drag-and-drop between columns

---

## 9. Open Items from Original Plan

- [ ] Fuzzy duplicate matching (`pg_trgm`)
- [ ] Tech-stack autocomplete from previous titles
- [ ] OTP cleanup (delete expired rows)
- [ ] GitHub last-commit ping
- [ ] Titles CSV export → expand into the fuller Export System above

---

## 10. Polish & Nice-to-haves 🟢

- [ ] Better empty states
- [ ] Loading skeletons
- [ ] Consistent toast notifications
- [ ] Mobile responsiveness pass
- [ ] Archive / soft-delete for old classes
- [ ] Better activity log viewer

---

## Suggested Order of Work (Updated)

1. ~~DB migration + stability~~ ✅
2. ~~Core UX (login, term, rules, theme)~~ ✅
3. ~~Progress + Leave Requests + basic Kanban~~ ✅
4. ~~Professor title edit + delete~~ ✅
5. **Student Reports system** (post-verification updates)
6. **Export system** (spreadsheet-style, group-aware)
7. Student Kanban view + drag-and-drop
8. Remaining open items + polish

---

## Notes

- Keep the “no real student accounts” philosophy.
- Prefer simple and reliable solutions.
- Every new feature should solve a clear professor or student pain point.
- Schema health: `npm run db:health`