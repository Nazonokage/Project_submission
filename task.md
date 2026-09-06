# v1.5 Student Dashboard — Task Checklist

## Phase 1 — Schema / Infrastructure
- [x] Update `src/lib/schema.ts` — add `updatedAt` + `deletedAt` to `projectUpdates`
- [x] Update `src/lib/schema.ts` — add `documentation` jsonb to `titleReports`
- [x] Remove verified-title edit block from `PATCH /api/student/titles/[titleId]/route.ts` (lines 35–37)

## Phase 2 — New API Routes (student side)
- [x] `GET /api/student/updates` — list project_updates for a titleId (excludes soft-deleted)
- [x] `POST /api/student/updates` — post new update entry → writes to project_updates + activity_log
- [x] `PATCH /api/student/updates/[updateId]` — edit headline/body → sets updated_at + logs activity
- [x] `DELETE /api/student/updates/[updateId]` — soft-delete → sets deleted_at + logs activity

## Phase 3 — New API Routes (prof side)
- [x] `GET /api/prof/updates` — list all updates per titleId/groupId including soft-deleted (with deleted_at visible)

## Phase 4 — Frontend: slot-dashboard.tsx restructure
- [x] Change tab values: `titles`, `submissions`, `board`, `group`
- [x] Smart default tab logic: `hasVerifiedTitle ? 'submissions' : 'titles'`
- [x] Wire `TabsList` with 4 new triggers in correct order
- [x] Build `TitlesTab` component (inline, absorbed from /verified/page.tsx — search + filters + read-only cards)
- [x] Build `SubmissionsTab` component (conditional inline/modal submit + all titles list)
- [x] Build `BoardTab` component (kanban + dropdown selector for multiple titles + updates panel)
- [x] Keep `GroupTab` completely untouched

## Phase 5 — Component updates
- [x] `TitleCard` — remove `pending/rejected`-only edit restriction; show edit btn for all statuses when `canEdit`
- [x] `TitleCard` — add inline Progress Reports section for verified titles (last 2 + Show all + Submit Report btn)
- [x] `TitleCard` — submit report dialog (version, changelog, progress_summary, repo_url, deployment_url, extra_links)
- [x] Board update panel — activity feed per title (list, add, edit, delete update entries)

## Phase 6 — Professor side
- [x] Add Board/updates read-only view to prof class/slot page
- [x] Show soft-deleted updates with [deleted] label + timestamp
- [x] Show edited updates with "Edited" badge + updated_at

## Phase 7 — Cleanup
- [x] Update `todo.md` to mark resolved items
- [x] Run `npm run build` — confirm zero type errors
