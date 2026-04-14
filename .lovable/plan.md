

## Convert Analytics Download to CSV

### Problem
The `generateReport()` function in `src/pages/Analytics.jsx` (lines 163–191) outputs a plain-text `.txt` file. It should produce a proper CSV to match all other downloads in the app.

### Changes

#### `src/pages/Analytics.jsx` — `generateReport()`

Replace the plain-text report with a multi-section CSV file:

- **Escape helper**: reuse the `esc(v)` pattern from other download functions
- **Section 1 — Membership Summary**: Headers: `Status, Count`. One row per status, plus a Total row.
- **Section 2 — Attendance Summary**: Headers: `Metric, Value`. Rows for Total Sessions, Total Check-ins.
- **Section 3 — Growth Indices**: Headers: `Milestone, Completed, Total, Percentage`.
- **Section 4 — Church Units**: Headers: `Unit, Members`.
- **Section 5 — Home Cell Centres**: Headers: `Metric, Value`. Rows for Active Centres, Total Attendance, Male, Female, Children, First Timers, Testimonies.
- Sections separated by blank rows with a section title row for readability
- MIME type: `text/csv`, filename: `.csv`

### Files Changed
- `src/pages/Analytics.jsx`

