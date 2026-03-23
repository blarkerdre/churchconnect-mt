

## Add Meeting Notes to Session Report

Add a text area for meeting notes in the Session Report section, saved alongside demographics.

### Changes — `src/pages/Attendance.jsx`

1. Add `meeting_notes` to `demoForm` state, initialized from `selectedSession.notes` when session changes
2. Add a `Textarea` labeled "Meeting Notes" in the Session Report section (between demographics and attachments)
3. Include `notes` in the `updateDemographicsMutation` payload so it saves to `attendance_sessions.notes`
4. Rename "Save Demographics" button to "Save Report" since it now saves both demographics and notes

### Database
No changes needed — `attendance_sessions` already has a `notes` text column.

### Technical Detail
- `demoForm` state expands: `{ male_count, female_count, meeting_notes }` 
- `useEffect` that syncs `demoForm` from `selectedSession` also sets `meeting_notes: selectedSession?.notes || ""`
- Update mutation adds `notes: meeting_notes` to the `.update()` call

