# Project-Submissions — Implementation Roadmap (v1.7.x → v1.8)

**Current implementation:** v1.7.3 (through Phase 18; automated tests pass, live DB release checks deferred)
**Target:** v1.7.4 Mobile Kanban & remaining v1.7.x phases, then v1.8 GitHub polish
**Last updated:** 2026-09-29

> Instructions for Codex / coding agents:
> - Work phase by phase. Do not skip schema health / `npm run build` gates.
> - Prefer additive migrations (new columns, new indexes, new tables). Keep existing behaviour working.
> - After every phase: `node scripts/schema-health.mjs` + `npx tsc --noEmit` + `npm run build` must be clean.
> - Manual click-test items are marked; do not mark a phase complete until the checklist is done or explicitly deferred.
> - Re-use existing patterns: Drizzle schema in `src/lib/schema.ts`, API routes under `src/app/api/`, shared modals, soft-delete where already used.


> Review: [Phase 14–16 findings and verification](docs/phase14-16-review.md).
> Automated route and isolated browser checks cover the changes. Real-database
> manual click tests are explicitly deferred; no production records were altered.
> Phases 17–22 remain unstarted. Dependency advisories are tracked in the review.

---

## Phase 14 — Title Validation & Stronger Duplicate Detection (v1.7.0)

> Goal: Blank titles are impossible. Near-duplicates are caught better than plain ILIKE.

### 14.1 — Server + Client validation
- [x] API: `POST/PATCH` title routes reject `text` that is empty, whitespace-only, or shorter than min length (5 chars after trim)
- [x] Frontend: title submit + edit forms enforce the same rules before submit (disable button + clear error message)
- [x] Keep existing `duplicate_check` mode (`strict` | `warn`) behaviour

### 14.2 — Fuzzy / trigram duplicate detection
- [x] Migration: enable `pg_trgm` extension if not present
- [x] Add GIN index on `titles.text` using `gin_trgm_ops` (scoped or at least class/slot filtered in queries)
- [x] Update duplicate-check query helper to use similarity / `%` operator (or `word_similarity`) in addition to / instead of plain `ILIKE`
- [x] Threshold configurable later; start with sensible default (e.g. similarity ≥ 0.4–0.5)
- [x] `strict` → block on high similarity; `warn` → show similar titles list and allow submit with confirmation
- [x] Update `scripts/schema-health.mjs` to verify extension + index exist
- [x] Update Drizzle / any raw SQL helpers used by student title submit and prof verification

### 14.3 — Cleanup
- [x] `npm run build` clean
- [x] Blank/short title and strict/warn behavior covered by route regression tests; live manual check explicitly deferred.

---

## Phase 15 — Slot Instructions + Class Archive/Delete (v1.7.1a)

> Goal: Professors can write instructions per slot; classes can be archived safely and hard-deleted only with confirmation.

### 15.1 — Schema
- [x] `ALTER TABLE project_slots ADD COLUMN instructions text` (nullable)
- [x] `ALTER TABLE classes ADD COLUMN archived_at timestamptz` (nullable)
- [x] Optional: `deleted_at` if you want soft-delete before hard cascade (prefer archive first) — omitted: archive plus confirmed hard delete selected.
- [x] Drizzle + schema-health updates

### 15.2 — APIs
- [x] Slot create/update accepts `instructions`
- [x] Class list endpoints default to non-archived; optional `?includeArchived=1`
- [x] `PATCH /api/classes/[classId]` supports archive / unarchive
- [x] `DELETE /api/classes/[classId]` hard-delete only after name confirmation payload (or separate confirm step); cascades already exist
- [x] Student slot dashboard returns `instructions` for the active slot

### 15.3 — UI
- [x] Prof slot settings: markdown or plain textarea for instructions
- [x] Student slot view: prominent “Slot instructions” card / panel (collapsible after first visit optional)
- [x] Class settings / dashboard: Archive class + Delete class (type class name to confirm)
- [x] Archived classes hidden from default class list; “Show archived” toggle optional

### 15.4 — Cleanup
- [x] Build + schema-health clean
- [x] Manual: instructions visible to students; archive hides class; hard delete requires confirmation — isolated browser fixtures; live-database manual check deferred.

---

## Phase 16 — Live Board + TanStack Query (v1.7.1)

> Goal: Student and professor board surfaces use cached server state and stay fresh without full-board loading flashes. Switching titles, refetching in the background, and mutations should preserve visible cached data.

### 16.1 — Query client and provider
- [x] Install `@tanstack/react-query`; optionally add `@tanstack/react-query-devtools` for development only
- [x] Create `src/lib/query-client.ts` with shared defaults: board `staleTime` around 15–30 seconds, reasonable `gcTime`, `retry: 1`, and window-focus refetching for board queries
- [x] Wrap the student and professor app trees with `QueryClientProvider` at a layout covering `/c/[classId]/...` and `/dashboard/...`; do not scope it to `BoardTab` or the cache will be lost on tab switches

### 16.2 — Stable board query keys
- [x] Define hierarchical keys in one place, e.g. `src/lib/query-keys.ts`
- [x] Include `titleId` (and class/slot identifiers where needed) in keys so switching projects cannot bleed cache
- [x] Define keys for board tasks, project updates/activity, board feedback when separate, and an optional combined board snapshot

### 16.3 — Board queries
- [x] Replace student `BoardTab` manual `useState` + `useEffect` fetches for tasks and project updates with `useQuery`
- [x] Move any board-scoped feedback list to `useQuery` when it is loaded by the board
- [x] Apply the same pattern to per-title/group data loaded by the professor progress board
- [x] Show a skeleton/spinner only for the initial load (`isPending && !data`); keep cached data visible during background fetching
- [x] A previously visited title should render from cache immediately while it refetches in the background; a fresh title may show the initial loading state

### 16.4 — Board mutations
- [x] Use `useMutation` for task create, status change (including drag-and-drop), edit, and soft-delete; use it for project update create, edit, and soft-delete
- [x] Prefer an optimistic cache update for task status moves; otherwise update with `queryClient.setQueryData` and/or invalidate only the affected title’s board keys
- [x] Do not use a full `onReload()` that clears the board or causes a full-board loading state
- [x] On mutation errors, roll back optimistic data and show a toast

### 16.5 — Live updates and cache integration
- [x] Use polling as the short-term approach (simple and reliable on Vercel); poll student and professor boards every 8–15 seconds while visible, and pause while `document.visibilityState === 'hidden'`
- [x] `refetchInterval` on board queries is acceptable; alternatively use lightweight delta endpoints and merge/invalidate the relevant query cache — Query polling selected.
- [x] If using delta endpoints, add routes such as `GET /api/student/titles/[titleId]/board-delta?since=<iso>` and the equivalent professor route — not needed; existing endpoints polled via Query.
- [x] Return fresh task/activity/feedback snapshots via existing endpoints; highlight open feedback and respect auth and existing soft-delete/audit filters
- [x] Polling/SSE must update or invalidate the React Query cache (`setQueryData` / `invalidateQueries`), not bypass it with local-only state; keep one source of truth
- [x] Avoid duplicate optimistic updates fighting with incoming poll results
- [x] Document the polling choice in code comments or `CHANGELOG.md`; treat SSE (`EventSource`) as an optional later upgrade only if hosting supports it cleanly
- [x] A subtle “Updated just now” / last-synced indicator is optional — optional indicator omitted.

### 16.6 — Scope and cleanup
- [x] Keep this phase to the student Board tab and professor board surfaces that currently flash on click; leave roster, titles list, auth, and other non-board fetch flows alone unless a shared change is trivial
- [x] `node scripts/schema-health.mjs`, `npx tsc --noEmit`, and `npm run build` clean
- [x] Manual: open Board; first load may show a skeleton once — isolated browser fixtures; live-database manual check deferred.
- [x] Manual: switch between previously visited verified titles; cached board appears without a full loading flash — isolated browser fixtures; live-database manual check deferred.
- [x] Manual: drag a task to another column; UI updates immediately without a full reload — isolated browser fixtures; live-database manual check deferred.
- [x] Manual: post a quick update; it appears without wiping the Kanban — isolated browser fixtures; live-database manual check deferred.
- [x] Manual: refocus the window; background refetch occurs without blanking the board — isolated browser fixtures; live-database manual check deferred.
- [x] Manual: two browsers open the same board; a task move or new update appears within the polling interval — isolated browser fixtures; live-database manual check deferred.

---


## Phase 17 — Tech-stack Autocomplete (v1.7.2) (completed)

> Goal: Tag input suggests previously used tech tags within the same class (or slot).

### 17.1 — Data
- [x] Helper query: unnest tech_stack from titles scoped by class_id and slot_id, ordered by frequency, excluding soft-deleted titles
- [x] Case-insensitive deduplication and normalization helper (`src/lib/tech-stack.ts`)

### 17.2 — API
- [x] `GET /api/student/slots/[slotId]/tech-tags` (student auth)
- [x] `GET /api/prof/slots/[slotId]/tech-tags` (professor ownership auth)

### 17.3 — UI
- [x] Enhanced `TechStackInput` component with dropdown combobox for existing tags
- [x] Allows adding custom new tags with keyboard/click actions
- [x] Case-insensitively dedupes on save across student/professor edit forms

### 17.4 — Cleanup
- [x] Build and regression test (`scripts/test-phase17-18.mjs`) clean

---

## Phase 18 — Verification Queue UX + Groupmates (v1.7.3) (completed)

> Goal: Prof approval list is easier to scan; shows submitter + group members.

### 18.1 — Data
- [x] Verification queue payload includes group members (id, name, identity) for each pending title

### 18.2 — UI
- [x] Horizontal scrollable card queue (`VerificationQueue`) for pending titles on professor dashboard
- [x] Cards display title, status badge, submitter info, and groupmate chips
- [x] Quick Approve / Reject action buttons directly on queue cards
- [x] Full review dialog (`TitleReviewDialog`) linked from cards

### 18.3 — Cleanup
- [x] Build clean and verified with component/route test suites

---

## Phase 19 — Mobile / Touch Kanban Polish (v1.7.4)

> Goal: Task board is usable on phones and touch devices.

### 19.1 — DnD
- [ ] Ensure HTML5 DnD or chosen library works with touch (or add touch polyfill / pointer events)
- [ ] Visual drop targets remain clear on small screens
- [ ] Fallback: status change via select / bottom sheet if drag is unreliable on a given device

### 19.2 — Layout
- [ ] Columns stack or become horizontally scrollable on narrow viewports without breaking drag
- [ ] Task cards: readable name, assignee, due date; actions not cut off
- [ ] “My Tasks” toggle and Add Task remain reachable

### 19.3 — Cleanup
- [ ] Build clean
- [ ] Manual: phone/tablet drag or status change; no horizontal overflow chaos

---

## Phase 20 — OTP Cleanup & Small Hygiene (v1.7.5)

### 20.1 — OTP
- [ ] On successful login **or** periodic/on-request: delete `professor_otps` rows where `expires_at < now()` or `used = true`
- [ ] Prefer on-login cleanup + optional lightweight cron/route if you already have one
- [ ] Do not break single-use or expiry checks

### 20.2 — Optional low-priority
- [ ] Notebook / doodle aesthetic pass (CSS variables, subtle paper texture, friendlier empty states) — only if time remains
- [ ] Anti-copy (`user-select: none` etc.) — **default off**; only add if product owner still insists after validation + fuzzy dupe land

### 20.3 — Cleanup
- [ ] Build + schema-health clean

---

## Phase 22 — Roster Progress Summary + Layout Polish (v1.7.6)

> Goal: Professors can see group membership and title activity per project slot at a glance, without opening every profile. Keep the roster readable on desktop and tablet.

### 22.1 — API: richer roster payload
- [ ] Extend `GET /api/classes/[classId]/students` (or add `?includeProgress=1`) with a per-student `slotProgress` array containing `slotId`, `slotLabel`, `inGroup`, nullable `groupId`, `pendingCount`, `verifiedCount`, `rejectedCount`, and optional `latestTitleText` / `latestTitleStatus` (`pending` | `verified` | `rejected` | `null`)
- [ ] Derive progress from existing tables only: `student_group_slots` → `groups` → `titles`, filtered by slot and `deleted_at IS NULL`; no new tables
- [ ] Keep the payload efficient: one query or a small fixed number of queries for the whole class, never N+1 queries per student
- [ ] Return the class `slots` as `{ id, label }[]` so the UI can align progress columns even when a student has no group membership

### 22.2 — Table layout
- [ ] Widen the roster container on this tab (`max-w-6xl` or the board tab's full width)
- [ ] Use a clear column structure: Name | ID | Creds | Status | Progress by slot | Actions
- [ ] Name: primary text and optional inactive badge
- [ ] ID: compact monospace text
- [ ] Creds: password in monospace, with an optional small “default” hint when it matches the class default
- [ ] Status: one compact block for group (`In group` / `No group`) and login (relative time / `Never`)
- [ ] Progress by slot: compact chip row, e.g. `P1 · none`, `P1 · 1 pending`, `P1 · verified`, or `P2 · 2 titles (1 verified)`
- [ ] Use muted styling for no work, amber for pending-only work, green when verified work exists, and a red tint when work is rejected-only; keep empty states short (`—` / `No work`)
- [ ] Actions: keep Edit, Profile, and Board in one horizontal row of compact controls on desktop; use an overflow menu on narrow screens if needed

### 22.3 — Optional student detail panel
- [ ] If the table remains dense, let a row or Details control open a right-side sheet/drawer rather than navigating away
- [ ] Show identity and credentials, per-slot group members (if any), title list with status, and last activity
- [ ] Include Edit, Open on board, and View full profile shortcuts
- [ ] Reuse the enriched roster payload; lazy-load deep title details from the existing student profile API if needed

### 22.4 — Filters and sorting
- [ ] Add client-side search by name or ID
- [ ] Add filter chips for `No group`, `Never logged in`, `Has pending`, and `Has verified`
- [ ] Keep the current default sort behavior unless intentionally changing it; name A–Z is the suggested default

### 22.5 — UI polish
- [ ] Use a sticky table header for long rosters
- [ ] Add subtle row hover or zebra styling
- [ ] Optionally add an eye-icon reveal/hide toggle for passwords while keeping credentials available for distribution
- [ ] Keep progress chips concise and aligned across slots

### 22.6 — Cleanup
- [ ] `npx tsc --noEmit` and `npm run build` clean
- [ ] Manual: a student with no group shows no-work chips for every slot
- [ ] Manual: a student with only pending titles shows an amber pending chip on the relevant slot
- [ ] Manual: a student with a verified title shows a green verified chip
- [ ] Manual: Actions stay on one line on desktop and remain usable on tablet
- [ ] Manual: if implemented, the detail panel matches the roster summary and its Board/Profile links work

---

## Phase 21 — Later / v1.8 (do not start until 14–20 and 22 are stable)

- [ ] GitHub commit auto-sync into project updates / task feed
- [ ] Background repo last-commit ping (`last_commit_sha`, `last_commit_at`)
- [ ] Term-based class archiving UX polish (if Phase 15 archive is minimal)
- [ ] Pure Option B single modal everywhere (if still desired)

---

## Suggested implementation order for Codex

1. **Phase 14** (validation + pg_trgm) — highest user pain, low UI surface
2. **Phase 15** (instructions + archive/delete)
3. **Phase 16** (live board polling)
4. **Phase 17** (tech-stack autocomplete)
5. **Phase 18** (horizontal verification queue)
6. **Phase 19** (mobile Kanban)
7. **Phase 20** (OTP + optional aesthetic)
8. **Phase 22** (roster progress summary + layout polish)
9. **Phase 21** only after the v1.7.x phases ship and their manual tests pass

---

## Global acceptance criteria (every phase)

- [x] Phase 14–16 schema declarations match the checked Neon columns and trigram index
- [x] `node scripts/schema-health.mjs` passes
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` zero type errors
- [x] Board, progress modal and professor review regression tests pass; live roster/auth/TitleCard click tests explicitly deferred
- [x] CHANGELOG.md entry per shipped version bump
- [x] Manual checklist for the phase completed or explicitly noted as deferred
