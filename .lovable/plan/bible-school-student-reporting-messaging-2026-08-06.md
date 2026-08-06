# Bible School: Student Reporting & Messaging

Add one place to filter, report on, and message Bible School students across their whole journey — application, registration, and course completion — using in-app, direct (one person), and bulk messaging.

## What gets built

### 1. New "Students" tab in Bible School
A new tab alongside Applications, Sessions, Attendance, etc. It respects the existing global Session/Edition filter bar.

Filters:
- Stage: Applied, Registered (approved), Exam link sent, Exam taken, Completed (passed), Incomplete/Failed
- Course/Programme
- Application source: QR/Public, Member self-register, Admin
- Date range (application or registration date)
- Free-text search (name, email, student number)

Summary cards for the current filter: total applicants, approved registrations, exam links sent, exams completed, passed, pass rate.

Results table: name, contact, course, edition, student number, stage badge, key dates. Each row has a message action; header has a select-all/bulk message action. CSV download of the filtered list.

### 2. Messaging
Reuses the existing message composer already used by member reports, which supports Email, SMS, WhatsApp and In-App notifications with `{first_name}` personalisation.

- Direct: message icon on any row opens the composer for that single student.
- Bulk: tick rows (or select all filtered) and message everyone at once.
- Whole-audience: "Message filtered students" button sends to the entire filtered result set.
- Every send is written to the audit log with the filter context, same as existing bulk messages.

### 3. Messaging on the existing tabs
So it is available where staff already work:
- Applications tab: per-row message action plus bulk message for selected applications.
- Registrations view (inside a course): per-row message action plus bulk message for selected registrations.
- Course results view: "Message passed students" and "Message incomplete students" shortcuts.

## Technical notes

- New component `src/components/exams/StudentsReportTab.jsx`, mounted in `src/pages/ExamManagement.jsx` as tab value `students`.
- Data comes from existing tables only — no schema changes: `wofbi_applications`, `course_registrations` (with `members`, `exam_sessions`), `exam_attempts`/`training_completions` for completion state. All queries keep the `.eq("tenant_id", tenantId)` guard and pass through `applySession` from `ExamSessionFilterContext`.
- Completion/pass logic mirrors the existing calculation in `CourseResultsView` (all subjects taken and aggregate score at or above the course pass mark) so numbers agree across screens.
- Messaging reuses `MessageFilteredMembersDialog` with `source: "bible_school"` and an audience label describing the active filters; recipients are mapped to member records so email/phone/`user_id` resolve correctly. Applicants without a linked member row can still receive email/SMS from their application contact details, and are excluded from the in-app channel with a visible count.
- Layout follows the mobile rules already applied to Bible School: scrollable tab strip, horizontally scrollable table, viewport-bounded dialogs.
