## What I verified

- The course **Basic Certificate Course (BCC) – August Edition 2026** has **29 approved registrations**, and **all six sessions (Day 1–Day 6) have zero attendance records** — so this is not unique to Day 2, nothing has ever saved for this edition.
- Day 2 (2026-08-04) is `closed` and, unlike Days 1 and 3–6, has **no auto-open/auto-close times**. The other days are also `closed` because their scheduled windows have already passed.
- The database write rules allow admins to insert/update attendance regardless of whether a session is open or closed, and the Edit dialog itself has no "session closed" block — so a closed session is not, by itself, what blocks the save.
- No database errors appear in recent logs from these attempts, and you report **no toast at all** when pressing Save. That points to the Save action never reaching the database rather than being rejected by it — the most likely cause on a 384px-wide phone is the dialog footer/date fields being overlapped by the fixed mobile bottom navigation, so the tap lands on the nav instead of the button.

Because the exact failure point can't be confirmed from data alone, step 1 of the plan is to confirm it on the live page before changing behaviour.

## Plan

### 1. Reproduce and confirm (no behaviour change)
Open Bible School → Attendance at phone width, expand a student, tap Edit on Day 2, and capture what happens when tapping the date fields and Save. This confirms whether the tap is being intercepted, the form is silently invalid, or a request is actually being sent and rejected.

### 2. Make the Edit attendance dialog usable on mobile
- Ensure the dialog content sits above the mobile bottom navigation (bottom padding / safe-area allowance) so the Save and Cancel buttons are reachable and not overlapped.
- Make the footer stick to the bottom of the scrollable dialog body so Save is always visible on small screens.
- Stack the "Time in / Time out" fields in a single column on narrow screens so the native date-time pickers get enough width.

### 3. Never fail silently
- Show an explicit warning toast when Save is blocked by validation ("Time in is required", "Time out must be after time in") instead of the mutation throwing with no visible feedback.
- Surface the underlying error text on any rejected write so the reason is visible instead of nothing happening.

### 4. Clarify session state in the UI
- Show a small "Session closed — you can still edit as an admin" note in the Edit dialog when the session is closed, so it's clear the closed badge isn't what's blocking the save.
- On the Day 2 session row, show that it has no auto-open/auto-close schedule (the only day missing one), so scheduling gaps are visible at a glance.

### 5. Re-verify
Repeat step 1 after the fixes and confirm a Day 2 record is actually written for a test student, then remove that test record.

## Technical notes

- All work is in `src/components/exams/WoFBIAttendanceTab.jsx` — the `saveEdit` mutation (validation/toasts) and the Edit-attendance `Dialog` markup (footer, layout, bottom-nav clearance).
- No database, policy, or edge-function changes are proposed; existing admin write policies on `wofbi_attendance_records` already permit these saves.
- No change to how attendance is counted or reported.
