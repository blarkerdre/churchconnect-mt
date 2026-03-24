

## Filter, Print & Download for Church/WSF Attendance + Settings Access Restriction

### Part 1: Church Attendance — Add Date Range Filter, Print & Download

**`src/pages/ChurchAttendance.jsx`**:
- Add date range filter (From/To date inputs) alongside the existing service type filter
- Filter reports client-side by date range
- Add Download button (CSV format with all columns: Date, Service Type, Title, Adult Male, Adult Female, Children, Teens, Total, Notes)
- Add Print button using `PrintReportButton` component
- Place these buttons in the toolbar area next to the filter

### Part 2: WSF Attendance — Add Date Range Filter & Print

**`src/components/wsf/WSFAttendanceTab.jsx`**:
- Add date range filter (From/To date inputs) alongside the existing centre filter
- Filter reports client-side by date range
- Add Print button using `PrintReportButton` (Download already exists)
- Update existing download to also respect date filter (it already filters by centre)

### Part 3: Settings — Restrict Sections to Super Admin

**`src/pages/Settings.jsx`**:
- Hide the "Certificates", "Links" (External Links), "Features" (Feature Toggles), and "Danger Zone" tabs from regular admins
- Only show these tabs when `isSuperAdmin` is true
- Currently only "Features" and "Danger" are restricted; extend the same pattern to "certificates" and "links" tabs

### Technical Details

- Date filters use `<Input type="date">` with state for `dateFrom` and `dateTo`
- Client-side filtering: `reports.filter(r => (!dateFrom || r.service_date >= dateFrom) && (!dateTo || r.service_date <= dateTo))`
- Church Attendance download generates CSV; WSF already has text download
- Print uses existing `PrintReportButton` component
- Settings tabs wrapped with `{isSuperAdmin && (...)}` pattern already used for features/danger

