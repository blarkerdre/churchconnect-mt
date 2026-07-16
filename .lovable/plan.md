
## Goal
1. Surface each student's **time-in and time-out per session** on the attendance report.
2. Let admins **edit and delete** individual attendance records straight from the report.

## Report UI changes (`WoFBIAttendanceTab.jsx`)

Replace the current single-row-per-student summary with an expandable report:

- **Summary row per student** (existing columns: #, Name, Present, Late, Absent, Total hours, Missing out, Attendance %) plus a chevron toggle.
- **Expanded panel per student**: a sub-table listing every course session in chronological order with columns:
  - Session date
  - Session title
  - Status (Present / Late / Absent)
  - Time in
  - Time out
  - Duration
  - Actions: **Edit** and **Delete** (admin only)

The expanded rows read from the same `allRecords` query, which already returns `checked_in_at`, `checked_out_at`, `duration_minutes` (extended in this plan to also include `id`).

CSV export unchanged (stays at student summary level).

## Edit dialog

New small dialog `WoFBIAttendanceRecordEditDialog` inside the tab file:
- Fields: Status (present / late / absent), Time in (`datetime-local`), Time out (`datetime-local`, optional).
- On save:
  - If status = **absent** → delete the record.
  - Else upsert into `wofbi_attendance_records` with the given `checked_in_at`/`checked_out_at`, recompute `duration_minutes` client-side (`max(0, round((out - in)/60000))`, or `null` when no time-out), keep `session_id`, `registration_id`, `member_id`, `tenant_id`, `source = "manual"`.
- Guarded by `isAdmin` (already enforced at the tab level).

## Delete action

Inline **Delete** button on each expanded row → confirm dialog (`window.confirm`) → `delete from wofbi_attendance_records where id = ? and tenant_id = ?`. Invalidate `wofbi-att-all-records`, `wofbi-att-roster-records`, `wofbi-att-record-counts`.

## Query tweak

Extend the `allRecords` select to include `id, session_id, registration_id, status, checked_in_at, checked_out_at, duration_minutes` so edit/delete can target rows directly (currently missing `id`).

## Out of scope
- Bulk edit / bulk delete.
- Editing session-level fields from the report (that stays in the sessions table).
- Server-side audit trail (existing tenant-scoped RLS + logs remain as they are).

## Files touched
- `src/components/exams/WoFBIAttendanceTab.jsx` — expandable report rows, edit dialog, delete mutation, `allRecords` select fix.
