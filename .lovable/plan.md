## Goal

Only students who are fully registered in a Bible School course can submit lecturer feedback — and only for the courses they are registered in.

## Definition of "completely registered"

A row in `course_registrations` for the signed-in member with:
- `status = 'approved'`, and
- a `student_number` assigned (registration confirmation completed).

## Changes

### 1. Rate Lecturer dialog (`src/components/exams/RateLecturerDialog.jsx`)
- Replace the "all active courses" query with a query on the member's own `course_registrations` (tenant-scoped, approved, student_number not null), joined to `exam_titles` for names.
- If the member has no qualifying registration: show a clear message ("Lecturer feedback is only available to students with a completed Bible School registration") and disable the Submit button.
- Course dropdown lists only their registered courses; subject list stays scoped to the chosen course.

### 2. Entry point gating
- Hide/disable the "Rate the Lecturer" button for members with no completed registration, so the dialog isn't a dead end.

### 3. Server-side enforcement (database)
- Tighten the `Students can insert own rating` and `Students can update own rating` policies on `lecturer_ratings` so the check also requires an approved registration with a student number for the same tenant, member and `course_id`. This prevents bypassing the UI.

## Technical notes

- Registration lookup keys off `myMember.id` from `useAuth`; users without a linked member record are treated as not registered.
- Existing one-rating-per-subject upsert behaviour (`tenant_id, subject_id, submitted_by`) is unchanged.
- All queries keep the explicit `.eq("tenant_id", tenantId)` guard.
