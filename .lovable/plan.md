

## Unit Meeting & Attendance — Enhanced Features

This plan renames "Unit Attendance" to "Unit Meeting & Attendance", adds demographic reporting (male/female/total), date filtering, and file upload capability to attendance sessions.

### Database Changes

**Add columns to `attendance_sessions` table:**
- `male_count` (integer, default 0) — male attendance count
- `female_count` (integer, default 0) — female attendance count
- `total_count` (integer, default 0) — auto-calculated total
- `unit` (text, nullable) — the church unit for this session

No new tables needed — file uploads will use the existing `ReportAttachments` component with the `documents` table and `church-documents` storage bucket.

### File Changes

**1. `src/components/AppLayout.jsx`**
- Rename nav item from "Unit Attendance" to "Unit Meeting & Attendance"

**2. `src/pages/Attendance.jsx`** — Major updates:
- Add date range filter (from/to date inputs) to filter sessions
- Add demographic fields (male, female) to the "New Session" dialog, with auto-calculated total
- Display male/female/total in session list items and stats cards
- Add `ReportAttachments` component for the selected session (upload/download meeting reports)
- Update report download to include demographic data
- Rename page title references to "Unit Meeting & Attendance"

**3. `src/components/attendance/SessionFormDialog.jsx`**
- Add male/female number inputs with auto-calculated total display
- Pass demographic data in the save payload

**4. `src/components/attendance/CheckInPanel.jsx`**
- Show male/female/total stats if available on the session

### Technical Details

- Date filter: two `<Input type="date">` fields filtering `sessions` array client-side by `session_date`
- Demographics: stored on `attendance_sessions` row, editable when creating/editing
- File uploads: reuse `<ReportAttachments relatedTable="attendance_sessions" relatedId={session.id} />` — no new storage setup needed
- Total is always `male_count + female_count`, computed on save and displayed read-only

