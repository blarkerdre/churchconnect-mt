

## Rename "Session" to "Meeting" Throughout Attendance Module

### Overview
Replace all user-facing instances of "Session" with "Meeting" across the attendance module UI. This is a text/label-only change — no logic, database, or variable name changes needed.

### Files & Changes

**`src/pages/Attendance.jsx`**:
- Line 84: toast "Session created" → "Meeting created"
- Line 110: toast "Session closed" → "Meeting closed"
- Line 124: Report text "Session:" → "Meeting:"
- Line 167: Summary card label "Sessions" → "Meetings"
- Line 188: SelectTrigger placeholder "Select session" → "Select meeting"
- Line 225: confirm text "Close this session?" → "Close this meeting?"
- Line 229: button label "Close Session" → "Close Meeting"
- Line 234: button label "New Session" → "New Meeting"
- Line 245: card title "All Sessions" → "All Meetings"
- Line 248: empty state "No sessions found" → "No meetings found"
- Line 299: empty state "No check-ins for this session" → "No check-ins for this meeting"
- Line 322: card title "Session Report" → "Meeting Report"
- Line 399: dialog title "New Session" → "New Meeting"
- Line 420: button text "Create Session" → "Create Meeting"
- Line 211: print report title "Session Report" → "Meeting Report"

**`src/components/attendance/SessionFormDialog.jsx`**:
- Line 55: dialog title "New Attendance Session" → "New Attendance Meeting"
- Line 58: label "Session Title" → "Meeting Title"
- Line 99: button text "Create Session" → "Create Meeting"

**`src/components/attendance/CheckInPanel.jsx`**:
- Line 194: confirm text "Close this session?" → "Close this meeting?"
- Line 197: button label "Close Session" → "Close Meeting"

**`src/components/attendance/SelfCheckInWidget.jsx`**:
- No user-facing "Session" text to change (uses dynamic titles)

**`src/components/attendance/SelfCheckIn.jsx`**:
- Line 88: button text "Back to Sessions" → "Back to Meetings"

### Scope
- Only user-visible labels, titles, placeholders, toasts, and confirm dialogs
- No variable, query key, or database column renames
- No logic changes

