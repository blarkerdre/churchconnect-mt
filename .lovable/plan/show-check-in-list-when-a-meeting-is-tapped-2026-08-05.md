# Show check-in list when a meeting is tapped

## What's happening now

The Church Unit meetings page already has a "Check-ins" card that lists everyone checked into the selected meeting, and it does refresh when you tap a meeting. On a two-column desktop layout it sits to the right of the meeting list. On a phone (your current 384px view) the layout stacks, so that card is far below the meeting list — tapping a meeting updates it off-screen and nothing appears to happen.

## What to build

1. Tapping a meeting in "All Meetings" brings the check-in list into view immediately:
   - On small screens, the selected meeting's check-ins open in a bottom-sheet style dialog titled with the meeting name and date, showing each checked-in member (initials avatar, name, check-in time, method), plus the Present/Total summary.
   - On larger screens keep the existing side-by-side card behaviour (no dialog), so nothing regresses for desktop users.
2. Add a small summary line to the check-ins view: total checked in, and for unit meetings the eligible member count.
3. Keep existing "Manage Attendance" access from within the mobile sheet for users who can manage, so they can add/remove check-ins without closing it.
4. Empty state stays clear: "No check-ins for this meeting yet."

## Technical notes

- File: `src/pages/Attendance.jsx`. Selection state (`selectedSessionId`) and the `records` query already exist — reuse both; no new queries or database changes.
- Extract the current check-ins list markup into a small local component so it can render in both the desktop card and the mobile dialog without duplication.
- Use the existing `use-mobile` hook (`src/hooks/use-mobile.jsx`) to decide dialog vs inline, and the existing `Dialog`/`DialogContent` with the project's mobile sizing pattern (`max-w-[95vw]`, `max-h-[85vh]`, scrollable body).
- No changes to RLS, mutations, or the report section.
