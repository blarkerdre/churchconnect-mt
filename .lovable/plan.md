## Goal

Unify the Bible School registration flow so a signed-in member registering from the Bible School page follows the same path as a public form/QR applicant:

1. Self-register → creates a `wofbi_applications` row (status `submitted`, `registration_origin = 'member_self'`), NOT a `course_registrations` row.
2. Admin reviews in **Bible School → Applications**, approves → the existing approval code inserts `course_registrations` (carrying the `member_self` origin).
3. Admin then sends/resends the **confirmation email** and **exam sign-in link** from **Registrations** using the buttons that already exist.

## Changes

### 1. `src/pages/ExamManagement.jsx` — `registerMutation` (member self-register on Bible School page)
Replace the direct `course_registrations` insert with an insert into `wofbi_applications`:
- Fields: `tenant_id`, `course_id`, `member_id`, `first_name`, `last_name`, `email`, `phone` (from the signed-in member's row), `status: 'submitted'`, `registration_origin: 'member_self'`, `answers: {}`.
- Guard against duplicates: if a `submitted` or `approved` application already exists for `(tenant_id, course_id, email)`, or a `course_registrations` row already exists for `(member_id, course_id)`, show a friendly toast ("Application already submitted" / "Already enrolled") and do not insert.
- Success toast copy: "Application submitted — you'll be notified once it's approved."
- Invalidate `["wofbi-applications"]` and `["my-course-registrations"]`.

Also update the "Registered" badge logic in the member-facing course list so it reflects application status too:
- Show **"Application pending"** when the member has a `submitted` application for that course.
- Show **"Registered"** when a `course_registrations` row exists (unchanged).
- Query `wofbi_applications` (course_id, status) alongside the existing `my-course-registrations` query and disable the Register button when either applies.

### 2. `src/components/exams/WoFBIApplicationsTab.jsx` — no logic change needed
The approval path (lines 166–199) already:
- Creates `course_registrations` with `registration_origin: app.registration_origin || 'public_qr'`.
- Emits audit + invalidates the Registrations query.

Because member self-registration will now carry `registration_origin: 'member_self'` on the application row, approved rows land in Registrations with **Source = Member**, and the Registrations tab's existing Send/Resend confirmation and Send/Resend exam link buttons work identically to Public/QR rows.

We will:
- Update `SOURCE_LABEL` (line 29) to include `member_self: "Member self-register"` so member applications are labelled clearly in the Applications tab.
- Extend the source filter dropdown (line 560) with a `member_self` option.

### 3. No DB migration
`wofbi_applications` already has `registration_origin`, `member_id`, `answers`, and the `submitted/approved` status vocabulary. No schema change needed.

### 4. Out of scope
- No changes to `public-wofbi-register` edge function.
- No changes to `send-course-registration-email` edge function.
- No changes to the exam-link sender.
- No new columns, no RLS changes.
- Direct admin enrolments (if any exist via other paths) are untouched.

## Files touched
- `src/pages/ExamManagement.jsx` (member-side `registerMutation` + pending-application query + button state)
- `src/components/exams/WoFBIApplicationsTab.jsx` (source label + filter option)
