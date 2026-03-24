

## Make Download & Print Available Anytime

### Problem
Currently, the Download and Print report buttons are inside the "Session Report" card which only renders when a session is closed (`isClosed && (isAdmin || isUnitLeader)`). Users cannot download or print attendance data for open sessions.

### Solution
Move the Download and Print buttons out of the Session Report card and into the toolbar area (near the session selector), so they are always available when a session is selected. The Session Report card (demographics form, attachments, save) remains restricted to closed sessions only.

### Changes

**`src/pages/Attendance.jsx`**:
1. Remove the existing Report button on line 203-206 (the one in the toolbar that just calls `generateReport`)
2. Replace it with both Download and Print buttons that are always visible when a session is selected
3. Keep the Session Report card's Download/Print buttons as-is for the closed/saved report flow (or remove them to avoid duplication)

Specifically:
- Lines 203-206: Replace the single "Report" button with both Download and Print buttons
- Lines 357-373: Remove the duplicate Download/Print from inside the Session Report card (since they're now in the toolbar)

