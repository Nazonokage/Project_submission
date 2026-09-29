# Phase 14–16 review — 2026-09-29

Implementation version: **1.7.1**. Existing local Phase 14 and partial Phase 15 work was retained and completed. Later roadmap phases were not started. This is an implementation/verification record, not a production deployment record.

## Findings addressed

| Area | Finding | Result |
| --- | --- | --- |
| Title validation | Professor create/edit did not enforce five trimmed characters; non-string input could fail unexpectedly. | Student/professor create/edit reject invalid title text. Forms disable invalid saves. |
| Duplicate detection | Student edits bypassed detection; deleted titles appeared as duplicates; warn mode submitted without explicit confirmation. | Shared similarity guard for student writes and professor writes/verification, class/slot filtering, self/deleted exclusion, server-driven warn confirmation. |
| Duplicate preview | Slow earlier preview requests could overwrite newer results. | Debounced requests are aborted on input changes and unmount. Server validation remains authoritative. |
| Submission limit | Deleted titles still consumed the group's title allowance. | Only non-deleted titles count. |
| Phase 15 UI | Instructions and schema existed locally, but archive/restore and confirmed deletion controls were missing; `BookOpen` was not imported. | Added lifecycle controls, archived filter, instruction payload validation and missing import. |
| Board refresh | Manual loading flags replaced the visible board on refresh; local fetches lacked persistent title caches. | Shared TanStack Query provider and scoped caches, title-specific mutations, optimistic task moves with rollback. |
| Professor activity | Activity endpoint authenticated a professor but did not check ownership. | Ownership is checked before reading the feed, including empty feeds and group-based requests. |
| Board layout | Four columns inside the narrow student container overlapped task actions. | Wider Board-only container and wrapping task controls. |

## Data and polling choices

- Existing configured Neon schema passed read-only checks: all 17 expected tables, required Phase 14–16 columns, `pg_trgm`, and the GIN trigram index definition. No migration was needed or applied during this review.
- Keep `phase14_schema.sql` and `phase15_schema.sql` for other environments. Both are additive and repeatable. Drizzle declares the index and new columns.
- Trigram similarity is `>= 0.4`, supplemented by a literal case-insensitive substring check. `%` and `_` in submitted titles are literal characters. This is application validation, not an atomic uniqueness constraint for simultaneous submissions.
- Archive means hidden from the default professor class list. Student access is preserved; use existing slot locking when submissions must stop. Permanent deletion requires the current class name and uses existing foreign-key cascades.
- Poll existing authorized endpoints every ten seconds, with `refetchIntervalInBackground: false`. TanStack Query's visibility/focus handling pauses hidden-window polling. SSE and delta routes are deferred.
- Query defaults: 20-second stale time, ten-minute unused-cache retention, one retry, stale-query refetch on focus. Query keys separate role/title and professor class/slot. Login navigation clears cached data.
- Cancel in-flight reads before optimistic moves and pause title reads during mutations. Roll back failed moves, then invalidate only the affected title. Mutation variables retain the originating title when selection changes.
- Professor review keeps existing deleted-item audit history. Student tasks/activity continue filtering soft-deleted items; open feedback is highlighted on the Board.

## Verification

Final validation on 2026-09-29:

| Check | Result |
| --- | --- |
| `node scripts/schema-health.mjs` | PASS against configured Neon; index definition verified |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; production pages generated |
| `npm run test:roadmap` | PASS, five regression groups |
| `npm run test:board` | PASS, 158 intercepted requests; zero database writes |
| `git diff --check` | PASS |
| `npm audit` | Findings remain: 1 critical, 3 high, 4 moderate |


`npm run test:roadmap` uses in-memory database/auth doubles and the actual route/helper code:

- Blank, whitespace-only, short, and non-string title submissions/edits rejected.
- Strict duplicate edits blocked; warn confirmation required and accepted explicitly.
- Generated duplicate SQL filters class, slot, self and deleted rows; substring wildcards remain literal.
- Invalid class-name confirmation cannot reach the delete operation.
- A professor cannot read another class's activity.

`npm run test:board` uses headless Microsoft Edge with fully intercepted API fixtures:

- Slot instructions visible; initial board load; cached switching between two projects without mixing tasks; cached tab return.
- Optimistic status changes and rollback after a simulated server failure; drag-and-drop.
- Task and project-update creation/editing/deletion without wiping the board.
- Independent browser contexts receive remote changes via polling.
- Hidden-window polling pauses and resumes on visibility; content remains visible.
- Professor review details, archive/default-list filtering, restore, and typed delete confirmation.

Browser fixture setup (PowerShell, first terminal):

```powershell
$env:JWT_SECRET='phase14-16-local-test-only'
npm run dev -- --port 3101
```

In a second terminal, make the `playwright` package available, or set `PLAYWRIGHT_MODULE` to an installed Playwright module path, then run:

```powershell
npm run test:board
```

The browser runner signs only synthetic fixture identities with the test secret. Every API request is intercepted; unexpected requests fail the suite. Never use this test secret in deployment. Close the test server when finished.

## Explicitly deferred release checks

- Real-database manual clicks for duplicate matching, instruction persistence, archive/restore, and cascading class deletion. Destructive tests ran only against fixtures.
- Two independently authenticated real users against a staging database; deployed Vercel polling/visibility behavior.
- Full live roster, OTP/email authentication, student account, and TitleCard workflows beyond the changed routes and build checks.
- Touch-device interaction remains Phase 19. Later phases 17–22 retain their roadmap status.

## Dependency review

`npm audit` reported **8 vulnerable packages: 1 critical, 3 high, 4 moderate**. These affect existing Next.js, Drizzle ORM/tooling, Nodemailer and transitive PostCSS/esbuild dependencies. The suggested remediation includes major-version upgrades. No forced audit fix was applied, and a passing build does not resolve these advisories. Plan and verify a separate dependency upgrade before treating this version as release-ready.

The new TanStack Query packages were not identified in this audit's findings. Counts reflect the registry response on the review date and may change.
