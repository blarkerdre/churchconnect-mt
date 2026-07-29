## 1. Quality Control: one check per subject

Today the rule is one QC per **lecturer + subject** (unique index `lecturer_qc_checks_lecturer_subject_uniq` on `tenant_id, lecturer_id, exam_subject_id`). Since a subject belongs to one course and one lecturer, the rule becomes one QC per **subject**.

- Database: drop the old unique index, add `lecturer_qc_checks_subject_uniq` on `(tenant_id, exam_subject_id)`. If any duplicate subjects already exist, keep the most recent and remove the older rows first (I'll check counts before running).
- `src/components/exams/QcCheckDialog.jsx`: change the duplicate pre-check to look up by subject only (drop the `lecturer_id` filter), and update the warning text to "A QC check already exists for this subject."

## 2. Auto start / close for Bible School attendance sessions

Add a scheduled window to each attendance session so it opens and closes itself.

- Database: add `scheduled_open_at` and `scheduled_close_at` (timestamptz, nullable) to `wofbi_attendance_sessions`.
- New security-definer function `auto_manage_wofbi_sessions()`:
  - sets `status = 'open'` where `scheduled_open_at <= now()` and (no close time or `scheduled_close_at > now()`) and status is not already closed manually;
  - sets `status = 'closed'` where `scheduled_close_at <= now()` and status = 'open'.
- Schedule it with pg_cron every minute.
- Also apply the window live inside `list_open_wofbi_sessions` and the QR-token lookup, so the persistent QR link is valid/invalid immediately at the boundary, without waiting for the cron tick.

### UI (`src/components/exams/WoFBIAttendanceTab.jsx`)
- In the create-session dialog add optional "Auto-open at" and "Auto-close at" date/time inputs, with a hint that leaving them blank keeps the session fully manual.
- Session list rows show a "Scheduled" badge with the open/close times when set.
- Manual Open/Close buttons stay and override the schedule for that session.

### Notes
- Times are entered in local (UK) time and stored as timestamptz.
- Existing sessions are unaffected (both new columns null = manual behaviour as today).
