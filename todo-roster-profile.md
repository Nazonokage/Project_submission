# Todo — Roster, Default Password & Student Profiles

**Status:** Shipped in v1.6.3  
**Context:** Professor roster + class-level credentials + student self-service profile  
**Related app:** [Nazonokage/Project_submission](https://github.com/Nazonokage/Project_submission)

---

## Goals

1. **Class default password** — one password for the class (default `2026`), changeable by the professor; new/imported students inherit it.
2. **Auto-generated IDs** — sequential `0001`, `0002`, …; manual add only requires **name**.
3. **Roster UX** — read-only table rows with summary info; **Edit** opens a modal (no inline onBlur editing).
4. **Professor student profile page** — full view of one student from the roster.
5. **Student “My account” page** — students can view their info and **change their own password**.

---

## 1. Schema & migration

- [x] Add column on `classes`:
  ```sql
  ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS default_student_password text NOT NULL DEFAULT '2026';
  ```
- [x] Update `src/lib/schema.ts` — `defaultStudentPassword: text('default_student_password').notNull().default('2026')`
- [x] Apply on Neon / run `db:push` (or project migration flow)
- [x] Confirm existing classes get default `2026`

---

## 2. Helpers

**File:** `src/lib/helpers.ts`

- [x] Add `nextStudentIdNumber(classId: string): Promise<string>`
  - Max of existing numeric `idNumber` in the class + 1
  - Pad to 4 digits (`0001`, `0002`, …)
  - Fallback `0001` if none

---

## 3. Class API — default password

**File:** `src/app/api/classes/[classId]/route.ts` (or equivalent)

- [x] GET already returns class — ensure `defaultStudentPassword` is included
- [x] PATCH accepts `defaultStudentPassword` (trim, non-empty; reject empty string)
- [x] Auth: prof session + `assertClassOwnedByProf`

---

## 4. Students API — add, import, prof profile

### POST add — `src/app/api/classes/[classId]/students/route.ts`

- [x] `name` required
- [x] `idNumber` optional → if missing, use `nextStudentIdNumber(classId)`
- [x] `password` = body password **or** class `defaultStudentPassword` **or** `'2026'`
- [x] Stop using random `generatePassword()` as the default for new students

### Import — `src/app/api/classes/[classId]/students/import/route.ts`

- [x] Starting ID = `nextStudentIdNumber(classId)` (avoid collisions with existing roster)
- [x] Sequential IDs for the batch
- [x] All rows use class `defaultStudentPassword` (not random)

### Student by ID (professor) — `src/app/api/classes/[classId]/students/[studentId]/route.ts`

- [x] Keep existing PATCH (name, idNumber, password) and DELETE
- [x] **New GET:** return rich profile payload:
  - `student` (full row)
  - `memberships` (slot label, group id/status, member names if easy)
  - `titles` linked to those groups (id, text, status)
  - optional `leaveRequests` for this student

---

## 5. Roster UI (professor)

**File:** `src/app/dashboard/[classId]/page.tsx` (`RosterTab` + related)

### Default password control

- [x] Show current class default password (input + Save)
- [x] Save → PATCH class with `{ defaultStudentPassword }`
- [x] Short hint: “New and imported students get this password. Edit a student to override.”

### Add form

- [x] Only **Name** field (remove required ID input)
- [x] Hint: ID auto-generated; password = class default

### Table (read-only)

- [x] Columns: **Name** | **ID** | **Password** | **Info** | **Actions**
- [x] **Info:** group status (`In group` / `No group`), last login (or `Never`), optional inactive badge
- [x] **Actions:**
  - **Edit** → modal (name, idNumber, password) → single PATCH
  - **View profile** → `/dashboard/[classId]/students/[studentId]`
  - **Open on board** (existing behavior)

### Edit modal

- [x] Replace `EditableRow` inline inputs
- [x] Modal fields: name, idNumber, password
- [x] Save → one PATCH; Cancel discards
- [x] Optional: Delete in modal (existing DELETE API)

### Export CSV

- [x] Keep Name / ID / Password export as-is

---

## 6. Professor student profile page

**Route:** `/dashboard/[classId]/students/[studentId]`  
**File:** `src/app/dashboard/[classId]/students/[studentId]/page.tsx` (new)

- [x] Auth / ownership checks (prof + class + student in class)
- [x] Back link → roster (`?tab=roster`)
- [x] Header: name, ID, last login, active status
- [x] Credentials card: ID, password (show/copy)
- [x] Groups by project slot (status, members if available)
- [x] Related titles (text, status)
- [x] Actions: Edit details, Open on board, Delete (confirm)
- [x] Load via new GET student profile API

---

## 7. Student “My account” page (student-facing)

Students currently have **no** profile/settings page. Add a minimal self-service page so they can see their info and change password (important once the class default is shared).

### Route & UI

**Route:** `/c/[classId]/me` (or `/c/[classId]/profile`)  
**File:** `src/app/c/[classId]/me/page.tsx` (new)

- [x] Requires student session for this class (existing middleware / `getStudentSession`)
- [x] Show read-only:
  - Name
  - ID number
  - Last login (if available)
  - Groups / slots they’re in (optional, nice-to-have)
- [x] **Change password** form:
  - Current password
  - New password
  - Confirm new password
- [x] Link into student nav (header or slot dashboard): “My account” / avatar → `/c/[classId]/me`
- [x] Logout still available (existing student logout)

**What students cannot edit (by design):**
- Name (prof owns roster)
- ID number (login identity)

### API

**File:** `src/app/api/student/me/route.ts` (new) — or under `src/app/api/student/profile/`

- [x] **GET** `/api/student/me`
  - Auth: student JWT
  - Return `{ id, name, idNumber, lastLoginAt, classId, memberships? }`
  - Do **not** return password hash/plaintext in the response
- [x] **PATCH** `/api/student/me`
  - Auth: student JWT (only self)
  - Body: `{ currentPassword, newPassword }`
  - Verify `currentPassword` matches stored password
  - Reject if `newPassword` empty / too short (e.g. min 4–6 chars)
  - Update `students.password` for that student only
  - Return success; never allow changing `name` or `idNumber` via this route

### Security notes

- [x] Only the logged-in student can change **their** password
- [x] Require current password before setting a new one
- [x] Prof can still override password from roster / prof profile (existing PATCH)

---

## 8. Out of scope (this pass)

- [ ] Per-student random password generation for new adds/imports
- [ ] Bulk “reset all students to class default password”
- [ ] Student editing their own **name** or **ID**
- [ ] Migrating existing random passwords to the class default automatically
- [ ] Email/OTP recovery for forgotten student passwords (still: ask prof / CSV)

---

## Acceptance checklist

### Professor / roster
- [x] Class has editable default password (starts as `2026`)
- [x] Manual add = name only → sequential ID + class default password
- [x] Import continues ID sequence and uses class default password
- [x] Roster table is summary-only; Edit = modal; View profile = dedicated page
- [x] Prof profile page shows credentials, groups, titles; edit/delete work
- [x] Existing students keep current passwords until edited (by prof or by student)

### Student
- [x] `/c/[classId]/me` reachable when logged in
- [x] Shows name, ID, last login (password not displayed)
- [x] Change password works with current + new + confirm
- [x] Wrong current password is rejected
- [x] Student cannot change name or ID via API/UI
- [x] Login still works with the new password afterward

### General
- [x] No schema breakage for groups, titles, login, middleware

---

## Suggested implementation order

1. Schema + `nextStudentIdNumber`
2. Class PATCH + students POST/import using default password
3. Roster UI (default password control, add form, table, modal)
4. GET student profile API (prof) + professor profile page
5. Wire “View profile” from roster
6. Student `GET/PATCH /api/student/me` + `/c/[classId]/me` page + nav link

---

## Notes

- Login flow stays **ID number + password** (unchanged).
- Class default only applies to **new** students unless a bulk-reset is added later.
- Shared default (`2026`) is fine for classroom handout; student change-password is the escape hatch.
- Match existing dark theme classes (`card`, `input`, `btn-primary`, `btn-secondary`, `text-muted`, etc.).
- Student session helper already exists in `src/lib/auth.ts` (`getStudentSession` / similar) — reuse it.
- Student login now stamps `lastLoginAt` so roster / profile “last login” is accurate.
