## Current behaviour (after approval + magic-link sign-in)

Once an approved applicant clicks the magic link and lands in `ExamManagement`, they are a real signed-in member with a `course_registrations` row. Here is what already works and what does not.

| Capability | Status | Why |
|---|---|---|
| Rate Lecturer | ✅ Works | `RateLecturerDialog` is rendered inside `ExamManagement` for members. It only needs `myMember` + auth user, both of which the provisioning flow creates. |
| Registration / Student Number | ⚠️ Auto-generated in DB, but not surfaced to the applicant | `trg_assign_student_number` on `course_registrations` assigns a number automatically when we insert the row in `provision-exam-account`. The magic-link email currently does not include it, and there is no post-login banner. |
| Statement of Result | ✅ Works | `StatementOfResult` in `ExamManagement` opens per course using `memberId` + `course_registrations`. Available as soon as they have attempts. |
| Certificate (PDF download) | ⚠️ Requires admin action | Certificates come from `training_completions`, which are issued by an admin via `IssueCertificateDialog`. Once issued, `MyCertificates` on `MyProfile` shows a Download button. Provisioning does not (and should not) auto-issue this — it stays admin-controlled. |

## Proposed changes to close the two gaps

### 1. Include the student number in the exam-ready email
- In `supabase/functions/provision-exam-account/index.ts`, after upserting `course_registrations`, re-select the row(s) to read the trigger-assigned `student_number` per course.
- Pass a `courses: [{ name, student_number }]` array into the email template data.
- Update `supabase/functions/_shared/transactional-email-templates/bible-school-exam-ready.tsx` to render a small "Your student number(s)" block above the "Start my exam" CTA, with a note that they will need it for the exam and certificate.

### 2. Show the student number in-app after magic-link login
- In `src/pages/AuthExamCallback.jsx`, after session hydration, fetch the member's `course_registrations` for the tenant and, if any have a `student_number`, show a one-time toast: "Your student number is XYZ" before redirecting to `/t/<slug>/exam-management`.
- No change needed on `ExamManagement` — student numbers are already displayed there per course card via existing `MyProfile`/`ExamManagement` code paths.

### 3. Certificate delivery (no code change, just confirm expectation)
- Certificates remain admin-issued via `IssueCertificateDialog` after results are finalised. The applicant will see and download them from `MyProfile → My Certificates` (existing `MyCertificates` component) once issued. We will not auto-issue on approval.

## Out of scope
- No changes to `RateLecturerDialog`, `StatementOfResult`, `MyCertificates`, `IssueCertificateDialog`, RLS policies, or the student-number trigger.
- No new public/guest routes — everything stays behind the magic-link session and existing `ProtectedRoute` + RLS.
