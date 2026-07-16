## Goal

Revert the auto-send behaviour on the Applications tab. Only the Registrations tab's Approve should send the confirmation/student-number email. The Applications tab should approve silently (no email).

## Changes

### `src/components/exams/WoFBIApplicationsTab.jsx`
In the `updateStatus` mutation:
- Remove the `sendConfirmationEmail` helper and both invocation sites (direct path after status update, and form path after enrolment).
- Restore the earlier toast copy that does not mention email: "Registration approved" / "Applicant approved and enrolled" / "Approved" / "Application approved".
- Drop `emailError` from the returned result object and from `onSuccess` logic.

No other behaviour changes:
- Status filter options (Approved — email pending, Exam link pending, Exam link sent) stay — they still reflect the state of the `course_registrations` row, which admins update from the Registrations tab.
- The `regRows` query keeps selecting `registration_email_sent_at` and `exam_link_sent_at` so those filters keep working.
- Registrations tab behaviour (auto-send on approve, gated Send exam link, Resend exam link label) stays as implemented.

## Files touched
- `src/components/exams/WoFBIApplicationsTab.jsx`
