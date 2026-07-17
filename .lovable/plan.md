Show session notes inside the Teens Attendance reports (`src/pages/TeensAttendance.jsx`).

## Changes

**Per-session `ReportDialog` (single session)**
- Under the dialog title, render `session.notes` in a subtle bordered "Session note" card. Hide when empty.
- Include a `Session note` line in the CSV export (single row above the table header).

**`CumulativeReportDialog` (detailed view)**
- Add `notes` to the session projection in the query select (`session:session_id (id, title, session_type, session_date, notes)`).
- Add a "Note" column to the detailed rows table, showing `r.session?.notes` (truncated with title tooltip when long, "—" when empty).
- Add "Note" to the detailed CSV header and each row (JSON-encoded to preserve commas/newlines).
- Summary view is per-teen, so notes don't apply there — leave it unchanged.

No database, RLS, or other module changes.