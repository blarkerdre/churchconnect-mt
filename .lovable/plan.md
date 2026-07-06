## Goal

Auto-generate a **student registration number** on the moment an admin approves a Bible School course registration, make it editable by tenant admins/owners, and surface it on the public confirmation, the member's profile/certificates, admin registration lists and Training Reports.

Note: this is distinct from certificate issuance. Registration numbers are now assigned earlier (at approval), and the certificate simply re-uses the same value on issuance.

## 1. Data model (migration)

- `course_registrations`
  - `student_number TEXT` — the WCIC/BCC/AUGUST/YYYY/NNN value.
  - `status TEXT NOT NULL DEFAULT 'pending'` — `pending` | `approved` | `rejected` (only if not already present; check first).
  - `approved_at TIMESTAMPTZ`, `approved_by UUID` (nullable).
  - Unique index on `(tenant_id, student_number)` where `student_number IS NOT NULL`.
- Extend existing `public.next_student_number(_tenant_id, _course_id, _completion_date)` so it also inspects `course_registrations.student_number` for the same month, so numbering stays continuous whether the row lives in `course_registrations` or `training_completions`.
- `training_completions` remains as-is; when a completion is created for an already-approved registration, we **copy** the existing `student_number` across (no re-generation).

## 2. Assignment flow

- **Public registration** (`public-wofbi-register` edge function): row is inserted with `status='pending'` and no `student_number`. Confirmation screen shows *"Your registration is pending approval. Your student number will be issued once approved."*
- **Admin approval**: new action on the admin registrations list ("Approve"). On approve:
  1. Set `status='approved'`, `approved_at`, `approved_by`.
  2. Call `next_student_number(...)` with today's date and store the result on the row.
  3. Trigger existing course-registration email, now including the assigned number.
- **Certificate issuance** (`issue-certificate/index.ts`): if a `course_registrations` row already has a `student_number`, use it verbatim; otherwise fall back to the current generator (preserves behaviour for pre-approval-flow rows).

## 3. Editing

- Tenant admins/owners get an inline "Edit number" button on each registration row (admin list + Training Reports detail).
- Server-side guard: only users with `has_role(auth.uid(),'admin')` or tenant owner may `UPDATE course_registrations.student_number` — enforced via a new RLS policy scoped to `tenant_id`.
- Every edit writes an `audit_log` entry via existing `logAudit` helper (`entity='course_registration'`, action=`student_number_update`, before/after values).
- Uniqueness guarded by the unique index; UI shows the DB error inline if a duplicate is entered.

## 4. UI surfaces

- **Public Bible School registration success screen** (`PublicWoFBIRegistration.jsx`): show a pending message + a note that the number will arrive by email once approved. When the approval email fires, include the number in the body of `send-course-registration-email`.
- **Member profile / My Certificates** (`MyCertificates.jsx` + `MyProfile.jsx`): add a "Bible School registration" section listing each `course_registrations` row with course name, status badge, and `student_number` (or "Pending" if not yet assigned).
- **Admin registrations list** (part of `ExamManagement.jsx` — the course roster panel): add columns `Status`, `Student No.`, `Approved`. Row actions: **Approve** (if pending) and **Edit number** (admin/owner only).
- **Training Reports** (`TrainingReports.jsx` + `CertificatesReport.jsx` exports): add `student_number` column; include in CSV export.
- **Certificate rendering**: unchanged — already prints the number.

## 5. Backfill

- One-off admin action on the Certificates Report page: for each approved `course_registrations` row without a `student_number`, generate one ordered by `created_at` using the same function. Idempotent.

## 6. QA

- Public registration → row created as `pending`, no number shown.
- Admin approves → `student_number` populated in the correct WCIC/BCC/MONTH/YYYY/NNN format; second approval same month increments; new month resets.
- Admin edits a number → change persists, audit log entry created; duplicates rejected.
- Non-admin user attempts to update `student_number` via API → RLS denies.
- Certificate for a completion tied to an approved registration reuses the existing number.
- Training Reports export contains the new column.

## Out of scope

- Changing certificate visual/layout (already shipped).
- Bulk re-numbering / renumbering already-issued certificates.
- Public verification page.

## Technical summary (for reference)

Files/objects touched:

- **DB**: migration adding `student_number`, `status`, `approved_at`, `approved_by` on `course_registrations`; unique index; RLS policy for admin-only `student_number` updates; small update to `next_student_number` to consider both tables.
- **Edge functions**: `public-wofbi-register/index.ts` (unchanged behaviour — still pending), new `approve-course-registration/index.ts` (approve + assign number + email), `issue-certificate/index.ts` (reuse existing number when present), `send-course-registration-email/index.ts` (accept optional `student_number`).
- **Frontend**: `PublicWoFBIRegistration.jsx`, `MyCertificates.jsx`, `MyProfile.jsx`, `ExamManagement.jsx` (registrations sub-view), `TrainingReports.jsx`, `CertificatesReport.jsx`.
