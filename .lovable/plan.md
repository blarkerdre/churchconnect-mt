## Goal

Stop auto-sending the exam sign-in link on approval. Move sending (and resending) to a manual admin action on each row in **Bible School Management → Registrations**.

## Changes

### 1. `src/components/exams/WoFBIApplicationsTab.jsx`
- In the approval `onSuccess` (around line 218–221), **remove** the auto-call to `provisionExamAccount.mutate({ id: variables.id, silent: true })`. Approval will no longer email anything to the applicant automatically.
- Keep the existing `send-course-registration-email` "you're enrolled" confirmation as-is (that's not the exam link).
- Keep the existing manual "Resend exam sign-in link" button (line ~823) on this tab too — still useful for form-source applications.

### 2. `supabase/functions/provision-exam-account/index.ts`
Extend the function to accept **either** input, so it can be triggered from the Registrations tab where we only have a `course_registrations` row:
- Existing: `{ application_id }`
- New: `{ registration_id }` — loads the registration, derives `tenant_id`, `member_id`, `course_id`, and the member's `email`/`first_name`/`last_name`/`phone`. If there is a matching `wofbi_applications` row (same tenant + member + course), use it; otherwise proceed directly from the registration + member.
- Same admin/owner authorization check against the derived `tenant_id`.
- Same magic-link generation + `bible-school-exam-ready` email send.
- Require the registration to be `approved`/`active` (mirrors the current "must be approved" guard).
- Return `{ ok: true, member_id, user_id }` as today.

No schema/migration changes.

### 3. `src/pages/ExamManagement.jsx` — Registrations tab
In the actions cell of each registration row (around lines 1129–1143):
- Add a new button visible when `isApproved && r.members?.email`:
  - Label: **Send exam link** if no send has happened yet, **Resend link** otherwise.
  - Icon: `Mail` (or `Send`) from lucide-react.
  - `onClick`: invoke `supabase.functions.invoke("provision-exam-account", { body: { registration_id: r.id } })` via a `useMutation`.
  - Toast on success: "Exam link sent" / on error: "Failed to send exam link".
  - Disabled while pending.
- Track "has been sent" client-side per session (a `Set` of registration ids in local state, seeded from any rows where the member already has a `user_id` — a good proxy that provisioning has already run). This is a lightweight cue for the Resend vs Send label; no DB column added.

Permission: gate with the same `canManageNumbers` used for the Approve button, so only admins/lecturers with number-management rights can send links.

### 4. Copy / UX
- Approval toast text stays as-is but no longer implies an email was sent. The new Registrations-tab button is the explicit send action.
- Tooltip on the button: "Email the applicant a one-click sign-in link to write the exam."

## Out of scope
- No changes to the approval flow itself, student-number generation, course registration creation, or the transactional email template.
- No changes to auth, RLS, or `course_registrations` columns.
- No retroactive send for previously approved registrations — admins press the new button when they're ready.

## Result
- Approving an application (form or direct) no longer emails the exam link automatically.
- Admins send the exam link from **Bible School Management → Registrations** with a per-row **Send exam link / Resend link** button.
- Existing "Resend exam sign-in link" button on the Applications tab remains for form-application workflows.
