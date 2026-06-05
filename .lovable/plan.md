## Goal
Remove the "Exam Sessions" feature from Bible School Management entirely and delete all session records.

## UI / code changes

**`src/pages/ExamManagement.jsx`**
- Remove `ExamSessionManager` import and its rendered block (the "Exam Sessions" section around line 290–291).
- In the Registrations table:
  - Drop `session_id`, `exam_sessions(name)` from the select.
  - Remove `sessionFilter` state, `sessionOptions`, the "All Sessions" Select filter, the Session column in the table, the Session field in CSV export, and the session piece of the filename/clear-filters logic.

**`src/pages/MyProfile.jsx`**
- Remove the `OpenSessionsPanel` import + usage (around line 1114) and the related session query block (~line 980–994).

**`src/pages/PublicWoFBIRegistration.jsx`**
- Remove the session picker UI and the `sessionCourses` / `exam_sessions` / `exam_session_courses` queries. Fall back to showing all active `exam_titles` for the tenant (existing behaviour when no session is chosen).

**`supabase/functions/public-wofbi-register/index.ts`**
- Drop session lookup and any `session_id` written into `course_registrations`.

**Delete component files** (no longer referenced):
- `src/components/exams/ExamSessionManager.jsx`
- `src/components/exams/OpenSessionsPanel.jsx`
- `src/components/exams/SessionEnrolDialog.jsx`

## Data deletion (migration)

Single migration:
```sql
UPDATE public.course_registrations SET session_id = NULL WHERE session_id IS NOT NULL;
DELETE FROM public.exam_session_courses;
DELETE FROM public.exam_sessions;
```

Tables and the `session_id` column stay in place (kept nullable) so historical schema, archive/export functions, and the types file don't need a churn. They simply hold no rows and are no longer surfaced anywhere in the UI.

## Out of scope
- Not dropping `exam_sessions` / `exam_session_courses` tables or the `session_id` column.
- No changes to grading, attempts, subjects, or course registrations beyond clearing `session_id`.
- No changes to `archive-tenant` / `purge-all-data` (still reference the tables harmlessly).
