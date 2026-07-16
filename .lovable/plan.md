## Goal

Unify the Bible School approve → email → exam-link flow so it works the same whether the applicant came via the application form (toggle ON) or via direct/member/public registration (toggle OFF). Also add status filters on both the Applications and Registrations pages.

## Flow (single source of truth)

For every Bible School row, admin action follows the same three-step lifecycle, driven by `course_registrations` timestamps:

```text
[Submitted / Pending]
      │  Approve button
      ▼
[Approved]  → automatically sends the registration confirmation email (with student number)
              button flips to "Resend confirmation"
              "Send exam link" button becomes enabled
      │  Send exam link
      ▼
[Exam link sent]
              button flips to "Resend exam link"
```

State is derived from row fields already present:
- `status` in ("approved","active") → step 2 reached
- `registration_email_sent_at` set → confirmation has been sent (show Resend)
- `exam_link_sent_at` set → exam link has been sent (show Resend)

## Changes

### 1. `src/components/exams/WoFBIApplicationsTab.jsx` — auto-send confirmation on Approve
In `updateStatus` mutation, when `status === "approved"`:
- **Form path (existing):** after creating the `course_registrations` row (or detecting one already exists), fetch its `id` and invoke `supabase.functions.invoke("send-student-number-email", { body: { registration_id } })`. This is the exact function the Registrations tab already calls on approve — it stamps `registration_email_sent_at` and includes the student number. Surface `emailError` in the success toast the same way `approveMutation` in `ExamManagement.jsx` (lines 927–957) does.
- **Direct path:** after updating the `course_registrations` row to `approved`, do the same invocation so direct/member/public rows get the identical confirmation email.

No change to what gets sent for `rejected`/other statuses.

Remove the outdated comment at lines 225–227 that says "No email is sent on approval here."

### 2. Applications tab — add status filter clarity
The status filter already exists (`statusFilter` with `all/submitted/approved/rejected`). Extend it with two derived options that read the joined `course_registrations` row for approved applications so admins can find rows stuck between steps:
- **"Approved — email pending"** (approved but `registration_email_sent_at` is null)
- **"Exam link sent"** (`exam_link_sent_at` is set)
- **"Exam link pending"** (approved + email sent, but no exam link yet)

Implementation: in the existing `regRows` query already fetched by this tab, also select `registration_email_sent_at` and `exam_link_sent_at`. Build a lookup by `(member_id, course_id)` and by `registration_id` for direct rows; use it in `statusMatches` for the new options.

### 3. `src/pages/ExamManagement.jsx` — Registrations tab
- **Auto-send on approve:** already implemented in `approveMutation` (lines 927–957). No change needed.
- **Button state logic (lines ~1398–1450):** already correct — `alreadySent = sentLinkIds.has(r.id) || !!r.exam_link_sent_at` flips exam-link label, and `regEmailSent = !!r.registration_email_sent_at` flips confirmation label. Verify and leave as-is.
- **Gate "Send exam link"** so it's only enabled once `registration_email_sent_at` is set (or the row's `status` is `approved/active` AND the confirmation button has been used). Show a small helper tooltip "Send confirmation email first" when disabled.
- **Add status filter** to the header toolbar (next to the existing Source/date filters):
  - `all` (default)
  - `approved_email_pending` — no `registration_email_sent_at`
  - `email_sent_link_pending` — email sent, no `exam_link_sent_at`
  - `link_sent` — `exam_link_sent_at` set
  Apply in the existing `filteredRegistrations` chain (lines 1115–1131).

### 4. No DB migration
All required columns (`registration_email_sent_at`, `exam_link_sent_at`, `student_number`, `approved_at`, `status`, `registration_origin`) already exist on `course_registrations`. No edge-function changes required — `send-student-number-email` and `provision-exam-account` are reused.

### 5. Out of scope
- No changes to `send-student-number-email`, `send-course-registration-email`, `provision-exam-account`, or `approve_course_registration` RPC.
- No changes to the public registration edge function or member-self registration flow.
- No changes to the delete flows or exam-taking flows.

## Files touched
- `src/components/exams/WoFBIApplicationsTab.jsx` — auto-send confirmation on approve (both form + direct paths); extended status filter with email/link-pending options; select the two timestamp columns in `regRows`.
- `src/pages/ExamManagement.jsx` — add status filter to Registrations toolbar; disable "Send exam link" until confirmation email has been sent.
