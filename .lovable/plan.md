## Goal

Ensure Bible School Management only shows applicants **after their application is approved** in the Applications tab, and eliminate the duplicate "one entry per applicant in both Applications and Registrations" behaviour.

## Root cause

`public-wofbi-register` currently creates **two rows** for every public sign-up:
1. A `wofbi_applications` row (status: `submitted`) — shown in the Applications tab.
2. A `course_registrations` row (status: `pending`) — shown in Bible School Management immediately.

That's why the same applicant appears in both places, and why unapproved applicants show up under a course before an admin has reviewed them. Approval in the Applications tab then inserts a *second* `course_registrations` row (if one didn't exist for that member/course), compounding the duplication.

## Changes

### 1. `supabase/functions/public-wofbi-register/index.ts`
- Remove the `course_registrations` insert and the "already registered for this course" pre-check that reads from it.
- Keep the `wofbi_applications` insert (this is now the single source of truth for a new applicant).
- Guard against a duplicate application: if a `wofbi_applications` row already exists for the same `tenant_id + course_id + email` with status `submitted` or `approved`, return a friendly "already applied / already enrolled" response instead of inserting again.
- Keep welcome + course-registration confirmation email triggers, but only fire the course-registration email on approval (moved — see step 2). The public form will send only the welcome / "application received" email.

### 2. `src/components/exams/WoFBIApplicationsTab.jsx`
- On approve, keep the existing behaviour that inserts a `course_registrations` row with `status: active, approved_at, approved_by` — this becomes the *only* path that creates registrations for public applicants.
- Trigger the course-registration confirmation email here (moved out of the public function) so applicants are notified only after approval.
- Stop merging `course_registrations` "direct" rows into the Applications list for members who also have a `wofbi_applications` row (dedupe by `member_id + course_id`, preferring the application row). This cleans up legacy duplicates already in the DB.

### 3. `src/pages/ExamManagement.jsx` (Bible School Management → course detail)
- Filter the registrations query to `status in ('approved','active')` so pending/submitted entries never appear here, even for any legacy rows.
- Small copy tweak on the empty state: "No approved registrations yet. Approve applicants from the Applications tab."

### 4. Legacy data cleanup (one-off `insert` migration)
For rows already created under the old flow:
- Delete `course_registrations` rows whose `status` is `pending` **and** that have a matching `wofbi_applications` row with status `submitted` for the same `tenant_id + course_id + member_id`. This removes the pre-approval duplicates without touching anyone who was already approved.

## Out of scope
- No schema changes; `course_registrations` and `wofbi_applications` structures stay as they are.
- Admin-initiated direct enrolments from Bible School Management (existing "Register member" flow) are unchanged — those still create an approved `course_registrations` row directly.

## Result
- Public sign-up → creates only a `wofbi_applications` row → appears in **Applications tab** only.
- Admin approves → creates the `course_registrations` row → applicant now appears in **Bible School Management** under the course.
- No duplicate row in either tab.
