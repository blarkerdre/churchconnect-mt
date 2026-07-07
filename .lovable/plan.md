## Home Cell Creation Report

Add a report that lists Home Cell centres by their `created_at` date, filterable by a date range.

### Where it lives
New section in `src/pages/WSFManagement.jsx` (Home Cell page), visible to admin, WSF leader, and reports officer (leaders see only their own centres — same visibility rule already used on that page).

Title: "Home Cells Created" — placed below the existing Attendance section.

### UI
- Two date inputs: **From** and **To** (defaults: From = first day of current year, To = today).
- Quick presets: This month, Last 30 days, This year, All time.
- Summary line: "N Home Cells created between {from} and {to}".
- Table columns: Name, City, Postcode, Leader/Host, Meeting Day, Status (Active/Hidden), Created (formatted date).
- Sort by `created_at` desc.
- "Print Report" button using existing `PrintReportButton` (buildRows returns the filtered rows).
- Empty state when no rows match.

### Data
- Reuse the existing `wsf-centres` query already loaded on the page (already tenant-scoped via `scopeQuery`). No new query, no schema change — `wsf_centres.created_at` already exists.
- Filter client-side by `created_at` against the selected range (inclusive; To is treated as end-of-day).
- For non-admin WSF leaders, restrict to `ledCentres` (matches existing behaviour on the page).

### Files touched
- `src/pages/WSFManagement.jsx` — add the new section + date state + filtered list + print button.
- New small component `src/components/wsf/WSFCreationReport.jsx` to keep `WSFManagement.jsx` tidy (accepts `centres` prop and renders filters + table + print).

### Out of scope
- No changes to `wsf_centres` schema.
- No changes to Reports Hub tile wording (the existing "Home Cell" tile already links to `/wsf`).
- No export to CSV (print only) unless you want it added.
