## Changes

### 1. Restore student number in exam-ready email
Edit `supabase/functions/_shared/transactional-email-templates/bible-school-exam-ready.tsx`:
- Re-add `courses?: { name, student_number }[]` prop and render the `numberBox` section (label + per-course student number + hint) above the "Start my exam" button.
- Keep the magic-link button and expiry hint.

### 2. Pass student number through provisioning
Edit `supabase/functions/provision-exam-account/index.ts`:
- When building `templateData`, include `courses: [{ name: courseName, student_number: registration.student_number }]` (or the existing multi-course shape if it already loads several) so the exam-ready template can render it.

### 3. Stop email on approve in Bible School Applications page
Edit `src/components/exams/WoFBIApplicationsTab.jsx` (~line 220–231):
- Remove the `supabase.functions.invoke("send-course-registration-email", ...)` call fired after approval.
- Leave the toast + enrolment behavior intact.

### 4. Keep approve → student-number email in Registrations
No change to `src/pages/ExamManagement.jsx` `approveMutation` — it already calls `send-student-number-email` after `approve_course_registration`. This remains the only path that emails the student number.

### 5. Deploy
Redeploy `provision-exam-account`. Templates are bundled with the send function so also redeploy `send-transactional-email`.

## Out of scope
- `send-course-registration-email` function itself (left in place, just no longer invoked from Applications approve).
- `send-student-number-email` function and Registrations page approve flow.
- RLS, roles, RPCs, other Bible School screens.

## Files touched
- `supabase/functions/_shared/transactional-email-templates/bible-school-exam-ready.tsx` (edit)
- `supabase/functions/provision-exam-account/index.ts` (edit — add courses to templateData)
- `src/components/exams/WoFBIApplicationsTab.jsx` (edit — remove approval email invoke)
