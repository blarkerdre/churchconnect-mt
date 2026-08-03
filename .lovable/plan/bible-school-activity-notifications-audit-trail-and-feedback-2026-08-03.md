# Bible School activity notifications, audit trail and feedback hints

Adds personal in-app receipts for Bible School activity, a full audit trail of that activity in System Logs, and visual hints showing students and QC officers which subjects they still have outstanding.

## 1. In-app notification receipts (recipient = the person acting)

A notification lands in the bell for the acting user only — no admin alerts, no email/SMS.

| Event | Notification |
|---|---|
| Student checks in (QR or worker-recorded) | "Checked in — {Course} · {Session}" |
| Student checks out | "Checked out — {Course} · {Session}" with time on site |
| Student submits Bible School course feedback | "Feedback received — {Course}" |
| Student submits lecturer feedback (rating) | "Lecturer feedback received — {Subject}" |
| Student completes/submits a subject exam | "Exam submitted — {Subject}" (with score when graded immediately) |
| QC officer saves a QC check | "QC check recorded — {Subject} · {Lecturer}" |

## 2. Audit trail in System Logs

Every one of the above events also writes an `audit_log` row (tenant-scoped, with actor, entity, target name and timestamp) so it appears on the Audit tab of System Logs with the existing plain-English rendering, filtering and CSV export. New action/entity labels are added so the entries read as sentences rather than raw table names, e.g. "checked in to Bible School attendance", "submitted lecturer feedback", "recorded a QC check".

## 3. Outstanding-feedback hints for students

On the student Bible School view:
- Each registered course shows a badge such as "2 subjects awaiting your feedback".
- Expanding it lists the subject names not yet rated, each opening the Rate the Lecturer dialog pre-filled with that course and subject.
- The Rate the Lecturer subject dropdown marks subjects already rated with a check, and defaults to the first unrated one.
- The course feedback form keeps its existing submitted/not-submitted state, surfaced in the same hint area.

## 4. Outstanding-QC hints for QC officers

In the Quality Control area:
- A summary line: "{n} subjects have no QC check for the current session".
- A list of course/subject/lecturer combinations with no QC row, each with a button that opens the QC dialog pre-filled with that course, subject and mapped lecturer.
- The QC dialog subject dropdown marks subjects already checked (they are blocked by the existing one-QC-per-lecturer-per-subject rule) so officers do not pick them by mistake.

## Technical notes

- Check-in/out receipts are inserted inside the `wofbi_checkin` SECURITY DEFINER function (and the worker-side manual paths in `WoFBIAttendanceTab.jsx`) so they fire on both routes; the existing `dispatch_web_push` trigger on `notifications` continues to work unchanged.
- Feedback, rating, exam and QC receipts are written client-side alongside the existing insert/upsert mutations in `WoFBIFeedbackDialog.jsx`, `RateLecturerDialog.jsx`, `TakeExamDialog.jsx` and `QcCheckDialog.jsx`, each including `tenant_id` and `user_id`.
- Audit rows use the existing `logAudit(action, entityType, entityId, details, tenantId)` helper for client paths and a direct `audit_log` insert inside the check-in function for the DB path.
- Outstanding hints are derived client-side by diffing `exam_subjects` for the registered course against `lecturer_ratings` (per `submitted_by`) and `lecturer_qc_checks` (per subject) — no schema changes needed for the hints.
- Only new-row inserts are added; no existing RLS policy, grant or table structure changes are required beyond confirming the `notifications` and `audit_log` insert policies allow the acting user (verified during implementation).
