

## Rename "BFC Report" → "BFC & Training Report" + Add Date Filter and Download

### Changes

**1. Rename label everywhere**
- `src/components/AppLayout.jsx` line 30: `"BFC Report"` → `"BFC & Training Report"`
- `src/pages/TrainingReports.jsx` line 127: heading → `"BFC & Training Report"`
- `src/pages/TrainingReports.jsx` line 129: description → `"Record attendance and outcomes for BFC and training sessions"`
- `src/pages/Settings.jsx`: update any reference from "BFC reports" → "BFC & training reports"
- `src/pages/Presentation.jsx`: update feature showcase label

**2. Add date range filter** (`src/pages/TrainingReports.jsx`)
- Add `filterFrom` and `filterTo` state (date strings)
- Add two date inputs (From / To) next to the existing type filter in the Session Records card header
- Apply `.gte("session_date", filterFrom)` and `.lte("session_date", filterTo)` to the query when set

**3. Add CSV download button** (`src/pages/TrainingReports.jsx`)
- Add a "Download CSV" button next to the filter controls
- On click, generate a CSV string from the current `reports` array (Date, Type, Title, Total, Male, Female, HG Baptism, Water Baptism, Notes)
- Trigger a browser download via `Blob` + `URL.createObjectURL`

**4. Add Print button** (`src/pages/TrainingReports.jsx`)
- Reuse the existing `PrintReportButton` component
- Pass a `buildRows` function that maps current filtered reports into the print format

### No database or migration changes needed

