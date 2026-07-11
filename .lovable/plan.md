## Goal

Make **Approve** in the Bible School Applications tab actually enrol the applicant into the course, and expose **Approve / Reject** buttons on every row (not just the detail dialog).

## Behaviour

### On Approve
1. Update `wofbi_applications` → `status='approved'`, `reviewed_by`, `reviewed_at` (existing).
2. If the application has a `member_id` **and** a `course_id`:
   - Check for an existing `course_registrations` row for `(tenant_id, member_id, course_id)`.
   - If none, insert a new `course_registrations` row: `{ tenant_id, member_id, course_id, status: 'active', registered_at: now() }` (student_number left null — matches current manual-assignment flow in Course Registrations).
   - If one already exists, skip the insert (idempotent) — no duplicate.
3. Invalidate `course-registrations` queries and toast "Applicant approved and enrolled" (or "Approved — already enrolled" when skipped).
4. If `member_id` is missing (public application not yet linked to a member), approve the status only and toast: "Approved. Link this applicant to a member record to enrol them into the course." No registration row is created.

### On Reject
Unchanged — just flips status to `rejected` with reviewer/timestamp. No cascade, no email.

## UI changes (`src/components/exams/WoFBIApplicationsTab.jsx`)

1. **Inline row actions**: in the applications table, add a compact actions cell with:
   - `Approve` icon-button (CheckCircle2) — hidden when `status === 'approved'`.
   - `Reject` icon-button (XCircle, destructive) — hidden when `status === 'rejected'`.
   - The existing `Eye` (view) and, for admins, `Trash2` (delete) buttons stay.
   - Buttons are disabled while `updateStatus.isPending` for that row id.
2. **Detail dialog**: keep existing Approve / Reject footer buttons; they call the same mutation.
3. **Mutation**: extend `updateStatus` (or add a parallel `approveApplication` mutation) to perform the enrolment side-effect above when `status === 'approved'`. Uses `supabase.from('course_registrations').select(...).maybeSingle()` for the dedupe check and `.insert(withTenant(...))`-style tenant scoping consistent with `ExamManagement.jsx` line 1335.
4. **Audit**: `logAudit` entry for each approval (`action: 'wofbi_application_approved'`, includes `enrolled: true/false`, `member_id`, `course_id`).

## Out of scope
- No email/SMS to applicant.
- No auto-issuing of `student_number` (still assigned in Course Registrations).
- No changes to Reject beyond current status flip.
- No backfill for previously approved applications.

## Technical notes
- No DB migration needed — `course_registrations` already accepts these fields (see `ExamManagement.jsx` line 1335 insert shape).
- Dedupe uses `.select('id').eq('tenant_id', tenantId).eq('member_id', …).eq('course_id', …).maybeSingle()`.
- Row action buttons follow the same styling pattern already used for the Trash2 button in this file.
