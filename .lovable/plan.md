## Goal
Make it self-evident which session/edition to pick when generating a Bible School Course Final Report.

## Current behaviour
- The "Session / edition" dropdown lists **every** exam session for the tenant, ordered newest-first, showing only the session name.
- It is **not** filtered by the selected course, so sessions that never ran that course still appear.
- "All sessions" writes a report covering the whole course history (no edition, no date range). Picking a named session sets the report's Edition to the session name and the cover date range to its start/end dates, and scopes registrations/attendance/results to that session.

## Changes (UI only)

1. **Filter the list to the selected course**
   Use the existing `exam_session_courses` link table to only offer sessions that actually include the chosen course. Show a "No sessions found for this course" empty state instead of an unfiltered list.

2. **Richer option labels**
   Each item shows: session name · date range (`12 Jan – 30 Mar 2026`) · a status chip (Open / Closed / Upcoming). Trigger shows name + dates so the current choice is readable at a glance.

3. **Explain the two modes**
   Helper text under the dropdown that changes with the selection:
   - *All sessions*: "One combined report across every intake of this course. Edition and dates are left blank for you to fill in."
   - *A named session*: "Report covers only this intake — edition, dates, registrations, attendance and results are scoped to it."

4. **Sensible default**
   When a course is selected and it has sessions, default to the most recent completed/closed session rather than "All sessions" (the usual case for an end-of-course report). Existing saved reports still load by their stored `session_id`.

5. **Show whether a report already exists**
   Mark options that already have a saved report with a small "Draft" / "Final" badge, so you don't accidentally start a second report for the same edition.

## Technical notes
- All work is in `src/components/exams/CourseReportTab.jsx`.
- New query joins `exam_session_courses` to `exam_sessions`, filtered by `tenant_id` and `course_id`.
- A lightweight query on `wofbi_course_reports` (tenant + course) supplies the Draft/Final badges.
- No schema or export-format changes.
