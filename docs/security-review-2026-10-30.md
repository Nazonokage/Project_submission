# Project vulnerability report

> Historical snapshot. See [implemented fixes and required deployment steps](security-fixes-2026-10-30.md) for the remediation status.

Date: 30 October 2026 (Asia/Manila). Project version: 1.7.6. Base commit: `fc6fa53`, including the existing uncommitted working changes.

**Overall risk: High. A critical dependency issue applies if the application is served from Windows.** Prioritize the framework upgrade, student credentials, and professor OTP protections before wider deployment.

This review found **11 findings: 1 conditional Critical, 3 High, 6 Medium, and 1 Low**. Separately, npm reports **10 affected dependency packages: 1 critical, 4 high, and 5 moderate**. Package counts include transitive dependencies and are not ten independently demonstrated attacks against this application.

## Scope and evidence

Reviewed the 60 API route files, authentication middleware and helpers, database schema and migration definitions, authorization and enrollment checks, password flows, relevant rendering and export components, application configuration, dependency lockfile, and existing test coverage. This was a source review with targeted offline reproductions, not an exhaustive penetration test.

- `node scripts/security-review-offline.mjs` completed successfully: nine observations reproduced using synthetic identities and mocked database responses. The five existing baseline checks imported by that script also passed. These checks intentionally demonstrate current defects; passing them does not mean vulnerabilities are fixed.
- `npm audit --json` completed after the initial restricted-network attempt failed. Full output is saved in `docs/security-audit-2026-10-30.json`.
- No real database queries, migrations, email delivery, account changes, or exploit requests against a running application were performed. Application behavior behind a deployed proxy, actual stored credentials, and deployed runtime settings remain unverified.
- Existing application edits were preserved. Only this report, the audit JSON, and the offline evidence script were added.

## Findings, in priority order

### F01 — Critical, conditional: vulnerable and unsupported framework; other affected dependencies

**Evidence:** `package.json:33` and the lockfile pin Next.js **14.2.35**. npm rates this package Critical. The current development workspace uses Windows; the production operating system is unknown.

The maintainer's [CVE-2026-75604 / GHSA-p293-qw3h-jr36 advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) covers Next.js `>=13.4 <15.5.24` and describes unauthenticated remote code execution on servers using a Windows filesystem. This application's version and App Router configuration match that advisory if it is served on Windows. No exploit was executed.

Other critical image-processing advisories depend on deployed image optimization and native libraries. `sharp` is absent from this lockfile, no `next/image` usage was found, and Linux image RCE was not demonstrated. Server Action-specific advisories also need separate applicability checks; no application `use server` declarations were found. These distinctions do not make the unsupported framework safe to retain. [Next.js support policy](https://nextjs.org/support-policy).

| Locked component | npm severity | Assessment and action |
| --- | --- | --- |
| next 14.2.35 | Critical | Upgrade to a supported patched release. npm suggests 16.4.3; treat this as a migration requiring compatibility checks. |
| nodemailer 6.10.1 | High | Receives user-supplied recipient strings in the public OTP flow. Upgrade; npm suggests 10.3.1. Parser abuse is relevant, but no live denial of service or OTP recipient bypass was demonstrated. |
| drizzle-orm 0.36.4 | High | Upgrade; npm suggests 0.45.4. The identifier-injection advisory is version-applicable, but no request-controlled SQL identifiers/aliases were found. |
| next's nested postcss 8.4.31 | High | Upgrade through Next.js. The root PostCSS is 8.5.26, which does not fix this nested copy. No student-supplied CSS pipeline was found. |
| source-map-js 1.2.1 | High | Update to a patched version; malicious source-map processing was not found in student flows. |
| postcss-selector-parser 6.1.4 | Moderate | Update; no student-controlled CSS processing identified. |
| drizzle-kit 0.28.1, esbuild, @esbuild-kit/core-utils, @esbuild-kit/esm-loader | Moderate | Four affected package entries in the development toolchain. Update Drizzle tooling and avoid exposing development services. |

Primary references: [Nodemailer parser DoS](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-v53p-9fqp-m79j), [Nodemailer recipient parsing](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8), [Drizzle identifier injection](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9). The Drizzle advisory specifically excludes applications using only static schema identifiers. Versions above are audit suggestions as of this report, not a guarantee that a major upgrade alone resolves every integration issue.

**Acceptance check:** upgrade with a reviewed lockfile; rerun audit, type checking, build, and authentication/authorization tests. Verify the version actually served in deployment. Do not apply `npm audit fix --force` without reviewing the migration.

### F02 — High: shared default student credentials and unlimited password attempts

**Evidence:** `src/lib/helpers.ts:6` defines the fallback password as `2026`; `src/lib/schema.ts:49` makes it the class default. Manual student creation uses it at `src/app/api/classes/[classId]/students/route.ts:97`; imports assign the same password to every imported student at `src/app/api/classes/[classId]/students/import/route.ts:36`. `src/app/api/student/login/route.ts:10` has no rate limiter. Students can choose passwords as short as four characters in `src/app/api/student/me/route.ts:9`.

**Impact:** someone with a class URL can obtain login IDs through F06 and try the known default. This takes one guess for unchanged default accounts. Changing the class default does not eliminate the shared-secret problem: a class member knows the initial password used by peers. Unlimited attempts also expose changed weak passwords to guessing.

**Validation:** the real login handler accepted a synthetic account with `2026`; 30 incorrect attempts returned 401 without throttling. Actual student password values were not inspected.

**Fix:** issue unique cryptographically random temporary credentials or one-use enrollment links, require a password change before access to project actions, enforce stronger password rules, and add atomic account/IP-based attempt controls with progressive delays. Avoid permanent account lockouts that attackers can trigger.

### F03 — High: student passwords are stored and returned in readable form

**Evidence:** password change writes `newPassword` directly at `src/app/api/student/me/route.ts:83`. Student creation/import and professor password edits also write raw text. `src/lib/password.ts:13` accepts plaintext as a legacy format, while the available `hashPassword()` helper is not used by these write paths. Roster responses return complete student rows (`src/app/api/classes/[classId]/students/route.ts:21`, `:64`), detail responses return the student row, and `src/components/dashboard/roster-tab.tsx:202` exports passwords.

**Impact:** database access, backups, professor sessions, exported files, or client-side exposure can reveal current student passwords. A student-chosen replacement remains readable to the professor through the roster API. This increases the damage of credential reuse elsewhere.

**Validation:** the offline password-change reproduction captured the exact new password in the database write.

**Fix:** hash every password write with the existing bcrypt helper; migrate existing plaintext values with a controlled process, then remove plaintext verification. Exclude passwords and hashes from response serializers and exports. Use reset operations rather than displaying existing passwords; distribute any temporary enrollment secret only once.

### F04 — High: professor OTP verification allows unlimited guesses

**Evidence:** `src/app/api/auth/verify-otp/route.ts:10` performs a database lookup per supplied code without an attempt counter, delay, or rate limiter. The five-code send limit applies to requesting email, not verifying guesses. `src/lib/helpers.ts:8` generates six-digit OTPs using `Math.random()` and the database validity window is ten minutes.

**Impact:** an attacker can request a victim's login code and make repeated verification guesses during its validity. There are 900,000 possible generated codes; hosting throughput and outside protections determine practical success. A correct guess grants a professor session. Multiple simultaneously valid codes increase the chance per attempt.

**Validation:** 30 wrong codes reached the actual handler and each returned 401, without a throttling response. No brute force against real accounts was attempted.

**Fix:** use `crypto.randomInt()`, validate an exact six-digit format, limit attempts per challenge/account and source, invalidate a challenge after a small number of failures, and retain one active challenge per login. Consume a correct code using a conditional atomic update that returns a row only once. The existing select-then-update at `verify-otp/route.ts:18` and `:36` also permits concurrent reuse in principle; that race was source-reviewed, not tested on PostgreSQL.

### F05 — Medium: deactivation and password changes do not revoke access

**Evidence:** student login checks the password but never rejects `isActive === false` (`src/app/api/student/login/route.ts:27`). `getStudentSession()` only verifies the JWT (`src/lib/auth.ts:95`), and password changes/reset writes do not update a session version or revoke sessions.

**Impact:** a deactivated student can log in again. A copied student cookie remains valid after a password change or reset, until expiry: one day normally, seven days with Remember me. Cookie deletion at logout only removes the local browser copy. An already-issued token can also retain class-level read access after deletion of the student because many routes rely only on its class claim.

**Validation:** login succeeded for a synthetic inactive student. Expiration/revocation behavior follows directly from the stateless verifier; stolen-cookie replay was not tested against a running server.

**Fix:** check current account existence, class membership, active status, and a server-side session/token version in a shared session guard. Increment/revoke on password changes, resets, and deactivation. Add session revocation for professor and remembered-device credentials as appropriate. Preserving remembered-browser trust on ordinary logout is documented product behavior, so it is not independently classified as a vulnerability here.

### F06 — Medium: public class URLs reveal the student roster

**Evidence:** `GET /api/classes/[classId]/directory` selects student names and login ID numbers without authentication (`src/app/api/classes/[classId]/directory/route.ts:13`, `:20`). This is intentional for the login combobox, but it exposes the entire roster to anyone holding the class URL.

**Impact:** privacy loss and easy targeting of student credentials. A UUID makes blind discovery difficult; it does not protect a class link once shared, forwarded, or exposed. F02 makes this disclosure materially more dangerous.

**Validation:** the route returned the synthetic roster with no authentication calls.

**Fix:** replace the public roster picker with individual ID entry, or gate roster discovery behind enrollment/access verification. Keep only the minimum public class metadata needed for login. `Cache-Control: no-store` prevents caching; it does not provide access control.

### F07 — Medium: exported student content can execute spreadsheet formulas

**Evidence:** `csvCell()` at `src/app/api/dashboard/[classId]/[slotId]/export/route.ts:10` escapes CSV punctuation but leaves formula prefixes intact; title text enters the export at `:103`. The roster exporter at `src/components/dashboard/roster-tab.tsx:204` neither escapes embedded quotes correctly nor neutralizes formulas.

**Impact:** a student can put a formula in a title or report field. When a professor opens the resulting CSV in a spreadsheet, the cell may be evaluated. Effects depend on the spreadsheet's protections and user interaction; external-link formulas may be used for phishing or data disclosure. Arbitrary system-command execution was not demonstrated.

**Validation:** the actual export handler emitted a synthetic title `=1+1+1` as a formula cell. This value also satisfies the application's five-character title minimum.

**Fix:** use a shared CSV serializer that escapes quotes/newlines and neutralizes formula-leading characters (`=`, `+`, `-`, `@`, and leading control characters), or export an XLSX with cells explicitly typed as text. Check both exports with Excel and another supported spreadsheet reader.

### F08 — Medium: task assignees are not authorized against the project group

**Evidence:** task creation accepts `assigneeStudentId` at `src/app/api/student/tasks/route.ts:64` and stores it at `:112` after checking only the requester's membership. Edits copy it directly at `src/app/api/student/tasks/[taskId]/route.ts:49`. The foreign key only establishes that the referenced student exists; the read path joins the student table by ID without a class condition at `tasks/route.ts:49`.

**Impact:** a group member can assign work to a nonmember. If a student UUID from another class is known, it can be referenced and that student's name/ID number surfaced by the task read endpoint. Unknown UUIDs are not practical to enumerate, and no other-class student ID was obtained during this review.

**Validation:** the creation handler persisted a synthetic foreign assignee value with no assignee membership lookup. Database foreign-key behavior was not mocked as an authorization control and no cross-class query was executed.

**Fix:** allow null or require the assignee to be an active member of the same group, slot, and class on both create and edit. Where possible enforce the relationship at database level and scope the read join defensively.

### F09 — Medium: invitation acceptance and group migration have race conditions

**Evidence:** `src/app/api/student/invites/[inviteId]/respond/route.ts:55` counts members before writes at `:82` through `:94`, without a shared lock or atomic transaction. The schema's membership uniqueness is per student/slot, not group capacity. Invitation creation similarly checks existing seats and pending invites before inserting.

**Impact:** parallel requests can reserve too many invites; concurrent acceptances can observe a free seat before either joins and exceed capacity. A failed draft-group migration after moving titles or deleting membership can leave partial state. Professor group changes use an advisory lock, but student flows do not participate in it.

**Validation:** source/schema review only; the concurrent schedule has not been reproduced against PostgreSQL. This is a transaction-integrity finding, not a demonstrated arbitrary group takeover.

**Fix:** make invitation creation/acceptance and migration atomic using Neon HTTP transaction batches or a database function, with a consistent group/slot lock used by all membership writers. Recheck membership, capacity, invite status, and ownership inside that boundary. Verify with simultaneous requests on an isolated database.

### F10 — Medium: OTP send controls can be bypassed and fail open

**Evidence:** `assertOtpRateLimit()` counts rows in `professor_otps` (`src/lib/rate-limit.ts:10`). Cleanup deletes used rows (`src/lib/helpers.ts:12`), and both login endpoints invoke it. Successful login deletes the evidence of a recent send. There is no source/global send limit. Count-then-insert is also non-atomic, and limiter exceptions return permission to proceed (`rate-limit.ts:20`, `:46`).

**Impact:** the advertised five-per-fifteen-minute limit is not a reliable send quota. An attacker controlling an inbox can repeatedly redeem codes to reset their count; requests across many recipient addresses evade the per-email boundary altogether. This can consume Gmail quota, generate unwanted emails, and deny legitimate login. Parallel title/report requests can also exceed their action limits.

**Validation:** source review of the count, cleanup, and send sequence. No emails were sent and no quota exhaustion was attempted.

**Fix:** record atomic attempts in a dedicated bounded rate-limit store independent of OTP cleanup, add source and service-wide send budgets, and return a controlled failure when the limiter is unavailable. Retain only the history required for the quota and expire it predictably.

### F11 — Low: a malformed instruction line can freeze rendering

**Evidence:** `parseBlocks()` at `src/components/ui/markdown-view.tsx:136` recognizes a pipe-delimited line as a potential table at `:189`. If it is not a valid table, the paragraph loop also refuses the line at `:252`, leaving the input index unchanged. The outer loop never terminates.

**Impact:** an instruction containing a single line such as `|ordinary text|` can freeze the professor's preview and the student slot page. Instructions are professor-controlled, so this is principally accidental denial of service or misuse by an already-authorized professor, not an unauthenticated student attack. Initial server rendering may also be affected; the full Next.js rendering path was not exercised.

**Validation:** the extracted production parser completed ordinary text and timed out after 100 ms for the single pipe-delimited line in a bounded VM.

**Fix:** always advance the parser index, treating an invalid table candidate as ordinary text. Add regression coverage for lone pipe lines and malformed/multiline tables.

## Additional observations requiring policy or deployment checks

- **Prior exposed secrets:** `README.md:12` states an old Gmail app password and JWT secret were shared previously. Rotation cannot be confirmed from this repository. Confirm rotation and invalidate old sessions if it has not happened. A leaked current JWT signing secret permits forged sessions. `.env.local` is ignored and is not currently tracked; its values were not printed, tested, or copied. Historical Git objects and external screenshots were not exhaustively scanned.
- **JWT role separation:** both role verifiers use the same key and accept the signature without validating role-specific claims or audience (`src/lib/auth.ts:28`, `:70`). The offline check confirmed a student JWT passes the professor verifier. Existing ownership checks still require a professor ID; no professor data access or privilege escalation was demonstrated. Validate payloads and use distinct audiences or purpose-separated keys. Remove the middleware's development-secret fallback and fail closed on missing configuration.
- **Broader read access than the UI suggests:** student title details, documentation, feedback, reports, tasks, and updates often check class membership without group membership; some omit slot enrollment and title verification checks. Public browsing of verified titles is explicitly documented, so class-wide visibility is not automatically a vulnerability. Decide whether drafts, rejection reasons, documentation, and feedback are also intentionally shared; if not, add group/enrollment/status guards and return a separate minimal browsing representation.
- **Unvalidated links:** deployment, commit, and report links can be stored without a shared protocol validator and then rendered in anchors. The main title repository validator is stronger than the report edit path. Restrict external links to approved HTTP(S) schemes and use the GitHub repository validator consistently. No browser script execution was demonstrated; this is not counted as confirmed stored XSS.
- **Resource limits:** task/update creation, documentation JSON, bulk imports, and several list endpoints lack application-level size, count, or pagination limits. Edge/proxy protections were not inspected. Add practical limits and rate controls, especially since any email owner can currently register as a professor. Open professor registration may be intentional; if deployment should be restricted to staff, enforce invitations or an approved roster.
- **Browser defenses:** no application-defined CSP/frame policy was found. Check deployed headers before classifying clickjacking or CSP gaps as exploitable. SameSite cookies provide some CSRF protection; missing explicit Origin/CSRF checks alone was not treated as a proven cross-site attack.

## Controls that help today

Professor routes generally check class ownership. Student mutation paths generally check group membership, and update edits check authorship. SQL query values use Drizzle parameters; no request-driven raw SQL concatenation was found. Session cookies are HttpOnly, SameSite=Lax, and Secure in production. Remembered-professor credentials have a separate derived key and validated audience. React text rendering and the Markdown component avoid raw HTML insertion. These controls reduce risk but do not resolve the findings above.

## Recommended remediation sequence

1. Upgrade the framework and affected dependencies, especially before serving from Windows. Verify earlier secret rotation.
2. Remove shared default passwords, hash all writes, remove credentials from APIs/exports, and throttle both login mechanisms.
3. Enforce account status and session revocation; restrict public roster access.
4. Fix CSV exports and task assignee authorization. Make group transitions and rate limits atomic.
5. Repair the Markdown loop; resolve read-visibility policy, link validation, headers, and resource limits.

For acceptance testing, use an isolated database and separate professor/class/group fixtures. Assert that inactive and revoked users fail, foreign assignees fail, disallowed cross-group reads fail, OTP challenges have bounded attempts and single atomic consumption, simultaneous joins cannot exceed capacity, and spreadsheet exports preserve untrusted content as text. Rerun dependency auditing after the final lockfile change.
