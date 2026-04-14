

## Convert All Downloads to CSV Format

### Problem
Two download functions currently output plain text (.txt) files instead of CSV:
1. **CheckInPanel.jsx** — attendance report downloads as `.txt`
2. **WSFAttendanceTab.jsx** — WSF attendance report downloads as `.txt`

All other downloads in the app already use CSV format.

### Changes

#### 1. `src/components/attendance/CheckInPanel.jsx` — `downloadReport()`
Convert the plain-text attendance report to a proper CSV with headers and rows:
- Headers: `Name, Status`
- Rows: each member with "Present" or "Absent"
- Add summary row at the end (Total, Present count)
- Change MIME type to `text/csv` and filename to `.csv`

#### 2. `src/components/wsf/WSFAttendanceTab.jsx` — `downloadReport()`
Convert the plain-text WSF report to CSV:
- Headers: `Date, Centre, Male, Female, Adults, Children, Total, First Timers, Testimonies, Notes`
- One row per report entry
- Change MIME type to `text/csv` and filename to `.csv`

### Files Changed
- `src/components/attendance/CheckInPanel.jsx`
- `src/components/wsf/WSFAttendanceTab.jsx`

