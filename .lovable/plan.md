
## Goal
Track each Bible School student's daily **time-in and time-out** for the full duration of a course, via the existing QR check-in flow, and surface totals (hours attended, days present) in the report.

## Data model changes
Extend `wofbi_attendance_records` (one row per student per session/day) with:
- `checked_out_at timestamptz` — set on second scan of the same day
- `duration_minutes int` — computed on check-out (`checked_out_at - checked_in_at`)

Keep the existing unique `(session_id, registration_id)` so one record per student per day. `checked_in_at` already exists and becomes the "time in".

## RPC changes
Update `wofbi_checkin(qr_token)`:
- First scan of the day for a student → insert row, set `checked_in_at = now()`, status `present`/`late` (existing logic).
- Second scan same day (record exists, `checked_out_at IS NULL`) → set `checked_out_at = now()`, compute `duration_minutes`, return `{ action: "checked_out", duration_minutes }`.
- Third+ scan → return existing record with a friendly "already checked out" message. No further mutation.
- Admin can still manually override via the roster panel (unchanged); manual entries can set/clear time-out too.

## UI changes

### `WoFBICheckin.jsx` (student-facing scan page)
- Show whether this scan was a **Time-in** or **Time-out**, along with the timestamp and (on check-out) the total minutes for the day.

### `WoFBIAttendanceTab.jsx`
- **Sessions table**: add a "Checked out" count column alongside Present / Late.
- **Roster panel** (per session): show `Time in`, `Time out`, `Duration` columns. Admin buttons:
  - "Set time-in now" / "Set time-out now"
  - "Clear time-out"
  - Existing Present / Late / Absent buttons remain for manual overrides.
- **Attendance report** (per course): add columns
  - `Days present`, `Days late`, `Days absent` (already effectively there)
  - `Total hours` (sum of `duration_minutes` across sessions, rendered as `Hh Mm`)
  - `Avg hours / day` (total hours ÷ days attended)
  - `Missing check-outs` (days with time-in but no time-out)
- CSV export gains the same columns.

### New session dialog
Add an optional **"Auto-close after (minutes)"** hint next to `late_after` — purely informational; sessions still close only when an admin closes them. Not required, can be skipped if you'd rather keep the form as-is.

## Out of scope
- Auto-closing sessions on a schedule.
- Geofencing / verifying the student is on premises for check-out.
- Editing historical `checked_in_at` / `checked_out_at` timestamps beyond "now" (can add a datetime picker later if needed).

## Files touched
- New migration: alter `wofbi_attendance_records` (add columns); replace `wofbi_checkin` RPC.
- `src/components/exams/WoFBIAttendanceTab.jsx` — roster columns, report columns, CSV export.
- `src/pages/WoFBICheckin.jsx` — display time-in vs time-out result.
- `src/integrations/supabase/types.ts` — regenerated after migration.
