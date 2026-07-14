## Goal

Split the current single "approve + email everything" flow in Bible School management → Registrations into two distinct actions:

1. **Approve** — assigns the student number (as today) AND emails the applicant their student number only.
2. **Send exam link** — emails a one-click magic link to start the exam only (no student number in this email).

## Changes

### 1. New email template — student number only
Create `supabase/functions/_shared/transactional-email-templates/bible-school-student-number.tsx`, modeled on `bible-school-exam-ready.tsx`:
- Congratulates the applicant on approval.
- Shows student number(s) prominently.
- No magic link / no "Start my exam" button.
- Explains that a separate exam link will follow when their exam is ready.

Register it in `supabase/functions/_shared/transactional-email-templates/registry.ts` as `bible-school-student-number`.

### 2. Trim the existing exam-ready template
Edit `bible-school-exam-ready.tsx` to remove the student-number section (numberBox). It becomes the exam-link-only email: intro, "Start my exam" button, expiry hint, sign-off. Copy adjusted so it no longer implies "approval just happened".

### 3. New edge function — send student number email
Create `supabase/functions/send-student-number-email/index.ts` (admin-only, mirrors auth/authorization pattern in `provision-exam-account`):
- Input: `registration_id` (or `application_id`).
- Loads the course registration + member + course + tenant.
- Requires `status ∈ {approved, active}` and a non-empty `student_number`.
- Invokes `send-transactional-email` with template `bible-school-student-number`, idempotency key `bs-student-number-<registration_id>`.
- Does NOT create auth users, magic links, or touch course status. Purely notification.

Deploy this function after creation.

### 4. Wire Approve → student number email
In `src/pages/ExamManagement.jsx` `approveMutation` (around line 909):
- After the RPC succeeds and returns a `student_number`, invoke `send-student-number-email` with the registration id.
- Toast: "Approved — student number emailed" on success; on email failure keep the approval toast but show a secondary destructive toast "Student number email failed".
- Keep the existing student-number display in the toast.

### 5. Keep Send exam link behavior, adjust copy
`provision-exam-account` already handles user provisioning + magic link generation + emailing. Since the exam-ready template no longer includes the student number, we can:
- Stop passing `courses` in the `templateData` from `provision-exam-account` (the trimmed template ignores it anyway — safe to leave, but we'll drop it for clarity).
- No functional change to the button; existing bulk "Send exam link to selected" continues to work.

### 6. No DB / RLS changes
No schema, policies, roles, or RPC changes. `approve_course_registration` RPC keeps its current behavior.

## Out of scope
- Auth, roles, RLS.
- Retry/queue tuning.
- Any other Bible School screens (applications tab, exam pages).
- Removing student number display from the UI.

## Files touched
- `supabase/functions/_shared/transactional-email-templates/bible-school-student-number.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/bible-school-exam-ready.tsx` (edit — drop student number block)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (edit — register new template)
- `supabase/functions/send-student-number-email/index.ts` (new)
- `supabase/functions/provision-exam-account/index.ts` (edit — drop `courses` from templateData)
- `src/pages/ExamManagement.jsx` (edit — approveMutation invokes new function; toasts updated)

Deploy affected edge functions after edits.
