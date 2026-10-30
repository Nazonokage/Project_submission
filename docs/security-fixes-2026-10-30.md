# Security fixes and deployment

The repository contains security fixes for the original report, with a user-approved exception for public student login search. **The database rollout below is required before deployment.** The password-storage compatibility migration was subsequently applied to 116 existing accounts after students reported login failures. Each password was preserved and verified against its new hash. No password resets, external emails, secret rotation, security SQL migration, or deployment were performed.

## Changes

- Patched dependencies: Next.js 15.5.28, React 19.3.1, Drizzle ORM 0.45.4, Nodemailer 10.3.1, and updated development tooling. Nested PostCSS and esbuild overrides remove vulnerable transitive copies. Next.js routes now await asynchronous parameters.
- Student passwords are hashed on every write. The login verifier requires bcrypt hashes. Existing plaintext passwords must first be migrated without changing their values. Newly created/imported students get separate random credentials, shown once to their professor. APIs and roster exports omit stored passwords and hashes. Password resets accept at least 12 characters, up to bcrypt's 72-byte limit.
- Professor roster details and profiles now provide **Show password** and **Issue new password**. Showing an old class-issued password succeeds only when the retained original matches the account's current hash. Individually changed passwords cannot be recovered; the professor can issue a replacement, shown in that page for copying. Recovery requires class ownership, is not cached or saved to browser storage, and replacement clears that account's login attempt bucket while revoking its old sessions. Ordinary student/roster responses still exclude passwords and hashes.
- Student login is throttled and rejects inactive users. Role-specific JWT audiences prevent token confusion. Session guards check current accounts and compare a credential version derived from the current password hash, so resets/changes revoke prior student cookies. Password changes clear the local cookie and return to login.
- Professor OTPs use cryptographic randomness, HMAC digests at rest, one active challenge per email, bounded verification attempts, and atomic conditional consumption. Dedicated atomic send counters survive OTP cleanup. Protection-store failures deny attempts with a controlled 503 response.
- Student login search is public by user request. It requires at least two characters and returns at most 20 active students from the linked class, with only names and login IDs. Empty searches return no roster. Names and IDs remain discoverable by anyone holding the class link; this accepts part of F06 in exchange for searchable login. Direct ID entry remains available. Private project detail endpoints require group membership and slot enrollment; the verified-title browsing endpoint retains a minimal class-wide browsing response.
- CSV exports quote fields correctly and neutralize formula prefixes. Task create/edit validates active assignees in the same group/slot/class. External links reject dangerous schemes, with rendering checks for older stored links.
- Invitation acceptance and draft migration run atomically in PostgreSQL. Database triggers serialize group/slot changes and enforce membership eligibility, seat limits, and invitation capacity, including when older routes write to these tables. Report creation uses a Neon HTTP transaction batch rather than an unsupported interactive transaction.
- Malformed pipe-delimited instructions no longer loop forever. Added frame restrictions, no-sniff/referrer headers, cross-site write rejection, request-length screening, import/text/link limits, and task/update rate controls.

## Required rollout order

1. Schedule a maintenance window and take a database backup. Keep the old application stopped while migrating credentials; otherwise old password writers can reintroduce plaintext. Preserve a rollback copy of the application and database together.
2. Confirm the previously exposed Gmail app password and JWT secret were rotated. Rotation of live secrets must be done through the relevant account/hosting controls. It cannot be verified from this repository.
3. Preview password migration counts:

   ```powershell
   node scripts/migrate-student-passwords.mjs
   ```

   The default mode reads existing credentials and prints counts only. It does not print passwords, hashes, names, IDs, or connection strings. Existing passwords are preserved by default. Review the counts before continuing.

4. Apply credential migration:

   ```powershell
   node scripts/migrate-student-passwords.mjs --apply
   ```

   All supported plaintext credentials are bcrypt-hashed **without changing the student's current password**, including existing short passwords. Each conversion is verified before saving. Existing bcrypt hashes remain unchanged. Password updates compare the old stored value so concurrent changes are not overwritten. This is the default behavior; `--preserve-existing-passwords` is also accepted explicitly.

   Weak/shared existing passwords remain usable after this compatibility conversion. New/reset passwords still follow the stronger policy. If a coordinated reset is desired later, explicitly use `--reset-weak-passwords` (preview first); this option invalidates weak/shared credentials and requires professors to distribute replacements. Do not use it merely to upgrade storage.


5. Apply database security guards, then check schema health:

   ```powershell
   node scripts/apply-sql.mjs security_hardening.sql
   npm run db:health
   ```

   Run password migration first so existing accounts can authenticate when the stricter verifier is deployed. An explicitly chosen weak-password reset also needs the old class defaults to identify shared credentials. The SQL clears those defaults and installs indexes, functions, and triggers. It does not delete student or project rows. It is safe to apply again. Resolve any pre-existing release migration requirements separately before deployment.

6. Build/deploy the updated application and restart all instances. Existing session cookies lack the new audience/version format and will require login again. Previously issued OTPs will not authenticate against the digest-based verifier. New accounts/roster imports now show a one-time credentials dialog; save and share each credential privately.
7. Test a professor login, a strong migrated student login, a reset account, group invitations, and a password change on the deployed environment. Confirm that the old student cookie fails after reset and that database health reports all security functions/triggers.

If a reverse proxy changes the application's apparent origin, set `APP_ORIGIN` to the canonical public origin, including scheme and port where relevant. Keep it consistent with the URL users visit. The current limiter includes account and service-wide budgets; source-address controls can also be enforced by the hosting edge using its trusted client-IP configuration.

## Validation

- Production build and TypeScript checks pass on Next.js 15.5.28.
- All fourteen existing/offline suites pass, including project-readiness, descriptions, enrollment, professor operations, and release migrations.
- `node scripts/security-review-offline.mjs` checks hashing, removal of plaintext authentication, one-time unique credentials, inactive-account rejection, rate-limit enforcement, private access, JWT role separation, credential revocation, OTP consumption/digests, CSV handling, safe links, and malformed Markdown.
- `node scripts/test-security-database.mjs` applies the actual migration twice to isolated PostgreSQL. It checks foreign membership rejection, invitation capacity, identity/replay protection, draft migration, rollback on a forced join failure, capacity reductions, actual rate-limit SQL, independent send quotas, and failure-closed behavior.
- All nine headless Edge suites pass: security, full board, professor remembered login, default tech stack, slot participation, profile titles, dashboard breadcrumbs, professor member removal, and password recovery. The board suite completed 214 intercepted requests. Browser fixtures do not send requests to the real database. The security suite also checks empty-directory withholding, searchable login, cross-site-write rejection, and oversized-write rejection against an isolated server using synthetic credentials.
- The final dependency audit reports **zero vulnerabilities** and is saved in `docs/security-audit-after-fixes.json`. The overridden development-tool transform was also exercised successfully.

PGlite runs in a single embedded PostgreSQL instance. These tests do not replace a multi-connection stress test on the target Neon environment, production proxy/header verification, or a full penetration test. Request-length screening uses Content-Length; enforce a streaming body-size limit at the hosting edge as well.

The original vulnerability report remains a historical snapshot of the reviewed code. Its reproduction script now contains regression assertions for the fixed behavior.
