## 1. Certificates Report — show full details for every issued/reissued certificate

File: `src/pages/CertificatesReport.jsx`

Data is already complete in the database (all 34 completions have `issued_by`; all 34 issue + 20 reissue audit rows carry `certificate_number`, `training_type`, `member_id`, `user_id`). No migration or backfill needed. The fix is purely presentational so the columns actually show on screen, CSV, and print.

**By Certificate tab** — already complete on screen; tighten print to match CSV:
- Update `buildCertsPrint` headers/rows to: Member, Email, Programme, Cert No, Completion Date, First Issued, Last Reissued, Reissue Count, Issued By.

**Activity Log tab** — currently shows Member from a name-only map. Enrich so each issued/reissued row carries member name + programme + cert no + issuer + readable date for every historical entry:
- Build `certMemberMap` from `members` table for any `details.member_id` not already covered by `completions` (handles legacy audit rows where the completion was deleted).
- Add columns to the on-screen table, CSV (`exportActivityCSV`) and print (`buildActivityPrint`): When, Action, Member, Programme, Cert No, Completion Date (from completion lookup when present), Issued By.

**By Programme tab** — already aggregates issued/reissued/uniqueMembers per programme; no change.

No schema or audit-log changes.

## 2. Drivers can filter & print their assigned passengers

File: `src/pages/Transportation.jsx`

Drivers already see only their own bookings via `visibleBookings` and have the date/status/search filters. The gap is the export/print toolbar — currently gated behind `isLeader`.

- Add a `canExport = isLeader || visibleBookings.some(b => b.driver_user_id === user?.id || b.assigned_to === user?.id)` flag.
- Show the existing **CSV** and **Print** buttons when `canExport` is true (Report dialog stays leader-only).
- Drivers' print title becomes "My Assigned Passengers — {dateFrom}–{dateTo}" when `!isLeader`; leaders keep "Transportation Report".
- Reuse the existing `downloadCSV` and `buildRows` — they already operate on `filtered`, so they automatically scope to the driver's own bookings.

No backend, RLS, or schema changes.

## Files touched
- `src/pages/CertificatesReport.jsx`
- `src/pages/Transportation.jsx`
