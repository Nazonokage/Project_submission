# Project-Submissions — TODO

**Current Version: v1.4 feature audit**  
**Next Target: v1.5**  
Last updated: 2026-09-04

---

## Audit summary
- The project has already shipped several v1.4-era features in the codebase.
- The old checklist was stale and did not reflect the current state of the app.
- Verified with a fresh build: `npm run build` completed successfully.

## Implemented in the current codebase

- [x] OTP rate limiting (max 5 per email in 15 minutes)
- [x] Action rate limiting for title/report submissions via `rate_limits`
- [x] Dark mode + persisted theme preference (`localStorage`)
- [x] Professor class page defaulting to the Board tab
- [x] Student click-through from roster to Board with group highlight
- [x] CSV export for class slot data
- [x] Professor / PM feedback system (`feedback` table + APIs + UI)
- [x] Version reports / progress reports (`title_reports`)
- [x] Report locking and edit controls (`is_editable`)
- [x] Professor title management (edit/delete/progress/verify)
- [x] Schema additions for feedback, rate limiting, title reports, and project updates

---

## Still pending / not fully applied

### High priority
- [ ] Convert the student “Submit Title” flow into a modal instead of a full tab
- [ ] Make the student verified view the default tab in the slot dashboard
- [ ] Finish the full board-driven reports workflow (post from board, show summary on cards)
- [ ] Polish the notebook / doodle design pass beyond the current paper theme
- [ ] Confirm the long-term migration strategy: raw SQL vs full Drizzle migrations
- [ ] Finish any remaining report-editing/locking edge cases for the student workflow

### Medium / later
- [ ] Student kanban drag-and-drop
- [ ] GitHub commit tracking + ping flow
- [ ] Fuzzy duplicate matching (`pg_trgm`)
- [ ] Tech-stack autocomplete
- [ ] Better loading/empty states across the app
- [ ] Export polish and per-group/report filters
- [ ] Mobile navigation / archive / activity feed improvements

---

## Project status

### Done now
- Professor auth + OTP flow
- Student auth + group flow
- Project slots + rules + locking
- Title submission + duplicate checks
- Verification queue + approve/reject
- Reports and feedback system
- Export and board navigation
- Dark mode and persisted theme preference

### Still not complete from the original v1.4 plan
- Submit Title modal
- Verified-as-default student view
- Full Kanban reporting UX
- Final notebook aesthetic pass
- Long-term migration cleanup

---

## Notes

- The project is in a stronger state than the old todo suggested.
- The app is already building successfully; remaining work is mostly refinement and polish rather than core feature construction.
- Keep the no-real-student-account model, simple DB logic, and professor-focused workflows.

---

## Old backlog kept for reference

### GitHub Commits (v1.5)
- [ ] Manual + automatic commit checks
- [ ] Soft background ping on board open
- [ ] Public repo fetch + save commit metadata
- [ ] Show commit info on board cards

### Other v1.5+ ideas
- [ ] Student drag-and-drop kanban
- [ ] Fuzzy duplicate matching
- [ ] Tech-stack autocomplete
- [ ] OTP cleanup job
- [ ] Better skeletons, filters, and mobile behavior
- [ ] Archive classes and threaded feedback