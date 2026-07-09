## Problem

On a member's profile, the Bible School section shows the "Score Report" (Statement of Result) button regardless of the `send_result_email` toggle. The user wants the profile to respect both toggles: Certificate and Statement should only be visible to the member when the corresponding email would have been sent.

Certificates are already hidden via `hiddenCourseNames` when `send_certificate_email` is off — no change needed there. Statement of Result is not gated today.

## Changes

### `src/pages/MyProfile.jsx`
1. In the `exam-titles-cert-flags` query (line ~188), also select `send_result_email`.
2. Derive a second list `hiddenStatementCourseNames = examTitles.filter(c => !c.send_result_email).map(c => c.name)`.
3. Pass it into the Bible School section (the component rendered around line ~672 that calls `downloadScoreReport`).
4. In that section, hide the "📄 Score Report" button when the course's name is in `hiddenStatementCourseNames`. Keep the subject list, take-exam buttons, and pass/fail badge intact — only the Statement download is suppressed, matching how certificates are hidden.

## Out of scope

- No change to admin `CourseResultsView` (admins can still send/print manually).
- No change to `send_certificate_email` handling — already respected.
- No change to grading, retake, or email pipeline.
