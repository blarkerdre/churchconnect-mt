## Why it says that

The note is informational, not an error. A Bible School attendance session loses its auto open/close times whenever it is opened or closed manually (the open/close actions and the edit dialog both null out `scheduled_open_at` / `scheduled_close_at`). So a manually closed session such as BCC August 2026 – Day 2 will always show "No auto open/close schedule". It does not block recording attendance — admins can still edit and save attendance on a closed session.

## Plan

### 1. Keep the schedule when a session is closed
Stop wiping `scheduled_open_at` / `scheduled_close_at` on manual open/close and on edit-with-closed-status. The saved window stays visible so the session's intended timing isn't lost, and manual status simply overrides it.

### 2. Only flag a genuinely missing schedule
Show the "No auto open/close schedule" note only for sessions that are still upcoming or open and truly have no times set. Past/closed sessions that ran to completion won't show it.

### 3. Wording
When a session is closed but still has a stored window, show it as "Scheduled: opens … · closes … (closed manually)" rather than the bare times, so the state is unambiguous.

## Technical notes

- All changes in `src/components/exams/WoFBIAttendanceTab.jsx`: the open/close mutations (~lines 324, 341), the edit mutation's `isClosed ? null : …` branch (~lines 290–291), and the session-row badge rendering (~lines 687–696).
- No database, policy, or cron changes; the auto-transition job already keys off status plus the scheduled times, and a manually closed session stays closed.
- No change to how attendance is recorded or counted.
