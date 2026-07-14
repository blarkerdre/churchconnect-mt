# Manual Course Registration Confirmation Email

## Goal
Stop auto-sending the course registration confirmation email. Add a manual **Send** button in the Course Registrations list (Exam Management), include the student number in the email content, and track sent status with a Resend affordance.

## Changes

### 1. Database
New migration adds a nullable timestamp column to track when the confirmation was sent:
- `course_registrations.registration_email_sent_at timestamptz`

No backfill — historical rows show as not sent.

### 2. Email template
Update `supabase/functions/_shared/email-templates/wofbi-course-registration.tsx` to accept and render a `studentNumber` prop in a highlighted box (similar to the Bible School student-number template). Keep the existing greeting/CTA structure and brand styling.

### 3. Edge function `send-course-registration-email`
- Accept `registration_id` (preferred) in the request body. Look up the registration → member (email, first_name), course (name), student_number, and tenant_id server-side using the service role.
- Require an authenticated admin caller (admin of the resolved tenant) or service role. Remove the "own-email" self-send path since this is admin-only now.
- Pass `studentNumber` into the template.
- After a successful send, stamp `registration_email_sent_at = now()` on the matching `course_registrations` row.
- Keep legacy inline fields as a fallback if `registration_id` is not supplied, but do not stamp the DB in that path.

### 4. Remove auto-send
- `supabase/functions/public-wofbi-register/index.ts`: remove the `triggerCourseRegistrationEmail` call and its helper. Application approval / registration no longer emails the confirmation automatically.
- `src/pages/ExamManagement.jsx` (member self-register path around L1590): remove the `supabase.functions.invoke("send-course-registration-email", ...)` call.

### 5. UI — Course Registrations list
In `CourseRegistrationsView` (`src/pages/ExamManagement.jsx`):
- Extend the select to include `registration_email_sent_at` (already selects `student_number`).
- Add a new column/action **Send confirmation**:
  - If `registration_email_sent_at` is null and `student_number` is present → show **Send** button.
  - If `student_number` is missing → button disabled with tooltip "Assign a student number first".
  - If `registration_email_sent_at` is set → show a **Sent** badge with the timestamp and a **Resend** button.
- On click, call `send-course-registration-email` with `{ registration_id }`. On success, invalidate `["course-registrations", tenantId, course.id]` and toast "Confirmation email sent".
- Track in-flight sends with a local `sendingRegEmailIds` Set (mirrors `sendingIds` pattern used for exam links).

## Out of scope
- Applications tab UI (approval flow), Bible School application page, exam-link flow, RLS/roles/RPCs, backfilling historical rows, bulk send.

## Files
- `supabase/migrations/<new>.sql` — add `registration_email_sent_at`
- `supabase/functions/_shared/email-templates/wofbi-course-registration.tsx` — add student number block
- `supabase/functions/send-course-registration-email/index.ts` — registration_id lookup, admin-only, stamp sent_at
- `supabase/functions/public-wofbi-register/index.ts` — remove auto-trigger
- `src/pages/ExamManagement.jsx` — remove self-register auto-send; add Send/Resend UI in registrations table
- Deploy: `send-course-registration-email`, `public-wofbi-register`
