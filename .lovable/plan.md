

## Lock Session Report After Save & Reorder UI

### Overview
Two changes to the Unit Meeting & Attendance Session Report section:
1. Once demographics/notes are saved, make the report read-only (no further edits)
2. Move file attachments (upload) above the Save button, and add a download/print report button

### Approach

**Track "report saved" state**: Use the existing `male_count`/`female_count` on the session to detect if a report has been saved. If `male_count > 0 || female_count > 0 || notes` has been saved, treat report as locked. Alternatively, add a simple `report_saved` boolean flag to `attendance_sessions` for explicit tracking — this is cleaner.

### Changes

1. **Database migration**: Add `report_saved boolean DEFAULT false` column to `attendance_sessions`

2. **Update `src/pages/Attendance.jsx`** (Session Report section, lines 303-344):
   - Set `report_saved = true` when Save Report is clicked (update the mutation)
   - When `report_saved` is true: render demographics and notes as read-only text instead of inputs
   - Move `<ReportAttachments>` above the Save button
   - Add a "Download Report" / "Print Report" button alongside the attachments section
   - The download button reuses the existing `generateReport` logic
   - Attachments remain editable even after report is saved (users may need to add files later)

### UI Layout (after changes)

```text
┌─ Session Report ────────────────────┐
│ Male: [input/text]  Female: [input] │
│ Total: [computed]                   │
│ Meeting Notes: [textarea/text]      │
│                                     │
│ 📎 Attachments                      │
│   [uploaded files list]             │
│   [Upload button]                   │
│