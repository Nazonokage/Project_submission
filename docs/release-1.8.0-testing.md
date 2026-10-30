# v1.8.0 release validation — 30 October 2026

**Code validation passed. Login regressions passed. Database rollout is still required before deploying this version.**

| Check | Result |
| --- | --- |
| Production build | Passed on Next.js 15.5.28 / React 19.3.1 |
| TypeScript | Passed |
| Lint | Passed with zero warnings/errors |
| Offline suites | 18/18 passed |
| Headless Edge suites | 9/9 passed |
| Dependency audit | Zero reported vulnerabilities |
| Current student password storage | 116 already migrated; zero pending conversions or resets |
| Configured database health | Base tables/columns/indexes pass; new security functions/triggers still need installation |

## Login coverage

The full-schema integration suite exports the current Drizzle schema into isolated PostgreSQL, applies all three release migrations twice, and exercises the real route handlers, bcrypt verification, signed cookies, and database session lookups.

- Existing short passwords remain valid after migration to hashes. Separate migration tests cover Unicode, spaces, wrong passwords, repeat runs, and opt-in resets.
- Newly created and imported students sign in with their individually issued credentials.
- Wrong passwords and inactive students are rejected. Deactivation invalidates an already-issued student session.
- Changing a password clears the cookie and invalidates its old copy. The old password fails and the replacement signs in.
- Professor OTP request stores a digest and verification establishes a real signed professor session.
- Wrong, expired, and consumed codes fail; the real database-backed verification limiter stops further guesses.
- Remembered-browser login skips another email. Forgetting the browser restores OTP verification.
- Browser checks cover searchable name/ID selection, keyboard selection and password focus, direct ID entry, password-change redirect, Remember me, logout, and Forget this browser.
- Professor password recovery checks cover matching an original class-issued password, refusing to reveal a changed password, ownership checks, replacement after account lockout, session revocation, and signing in with the displayed replacement. A direct check of the previously reported local account returned HTTP 200 and a session cookie with its existing assigned password; no password value was printed or changed.

No real student password was guessed or printed. The configured database password check was read-only; the earlier compatibility migration had already converted all 116 accounts. **Gmail delivery was simulated, not sent to real inboxes**, so actual delivery/provider quota remains a deployment smoke check.

## Other workflow coverage

The nine browser suites cover the board, dashboard navigation, technology defaults, member removal, professor remembered login, profile title/group operations, security/login, per-slot enrollment, and professor password recovery. They use synthetic credentials and intercept application API requests. The isolated server has unusable database and email credentials, preventing fixture tests from changing real records or sending mail.

Offline suites cover title readiness and approval, shared descriptions, notifications/read receipts, authorization, professor group operations, enrollment, CSV/URL/Markdown protections, and database migrations. The full-schema test additionally persists a task and accepts a group invitation through the actual security function.

The release check found and fixed a deployment defect: the old SQL runner split function bodies at semicolons and sent transactions as separate HTTP requests. It now preserves PostgreSQL quoted bodies and submits one atomic Neon transaction batch. Regression tests verify quoting, rollback, and the actual release migration files. The missing lint configuration was also installed; reported errors and effect-dependency warnings were corrected without suppressing rules.

## Before deployment

1. Confirm the previously exposed Gmail/JWT secrets have been rotated. This has not been verified by repository tests.
2. Take a backup and use a maintenance window for the release migrations. Password migration now preserves existing passwords by default; the configured database already needs no further password conversions.
3. Apply, with the matching application release:

   ```powershell
   node scripts/apply-sql.mjs consolidate_project_description.sql
   node scripts/apply-sql.mjs enforce_approval_planning.sql
   node scripts/apply-sql.mjs security_hardening.sql
   npm run db:health
   ```

4. Restart/deploy the application, then smoke-test actual Gmail OTP delivery and a known student account in the target environment. Old session cookies require sign-in again.

No application push, deployment, or database security migration was performed during this validation. The version is prepared as **1.8.0** in both package files, with changes recorded in `CHANGELOG.md`.

## Reproducing the checks

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:browser
npm audit
```

`npm run test:browser` manages its own isolated production server and requires Microsoft Edge. Machine-readable results are in `docs/release-test-results.json`; dependency results are in `docs/security-audit-after-fixes.json`. Multi-connection Neon stress tests and real Gmail delivery are outside these isolated tests.
