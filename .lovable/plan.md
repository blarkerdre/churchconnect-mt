## What's happening

Deleting the Bible School session "AUGUST EDITION 2026" fails with a unique-constraint error. Confirmed cause:

- Deleting a session sets `session_id` to NULL on any linked Course Final Report (`wofbi_course_reports`, `ON DELETE SET NULL`).
- That table has a unique rule on tenant + course + session, where "no session" is treated as a real value.
- Your data already has two reports for the same course under this church: one tied to the AUGUST EDITION session, and one with no session. Blanking the session on the first would create a duplicate "no session" report for that course, so the database rejects the whole delete.

So it is not a permissions problem — it is the leftover session-less report for that same course blocking it.

## Fix

1. Database migration: change the report link so deleting a session no longer collides.
   - Replace the `ON DELETE SET NULL` behaviour on `wofbi_course_reports.session_id` with `ON DELETE CASCADE`, so a report belonging to a deleted session is removed with it (a report is an artefact of that specific edition), OR keep SET NULL and make the unique rule ignore session-less rows.
   - Recommended: `ON DELETE CASCADE`, which matches how the report is created per session and avoids ever producing duplicate unscoped reports.

2. UI safety in `src/components/exams/SessionManager.jsx`:
   - In the delete confirmation dialog, show how many course final reports, registrations and exam attempts are attached, and state plainly that reports for that edition will be deleted while registrations keep their data.
   - Keep the delete button hidden/disabled with an explanatory note when the session has exam attempts (those are still protected by a restrict-style link and can never be deleted).
   - Improve the failure toast to show the database's own message so future blockers are self-explanatory.

## Technical notes

- Constraint involved: `wofbi_course_reports_unique_scope` on `(tenant_id, course_id, COALESCE(session_id, '000...0'))`.
- FKs to `exam_sessions`: `exam_session_courses` (CASCADE), `course_registrations` (SET NULL), `wofbi_course_reports` (SET NULL — to change), `exam_attempts` (no action, still blocks deletion by design).
- No RLS or grant changes needed; admin policies on `exam_sessions` and `exam_session_courses` are already correct.
