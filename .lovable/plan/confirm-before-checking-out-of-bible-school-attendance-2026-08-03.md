# Confirm before checking out of Bible School attendance

Today, when a student who is already checked in scans the Bible School QR code again, the page immediately records a time-out with no confirmation. An accidental re-scan silently ends their session. This adds an explicit warning step.

## What changes

**QR self check-out (student-facing)**
- On a repeat scan while checked in, the page no longer records the time-out automatically. Instead it shows a warning card:
  - "You're already checked in" with the time they checked in and how long they've been on premises.
  - Two actions: "Yes, check me out" (records the time-out) and "No, stay checked in" (closes with no change).
- First-time scans (check-in) and scans after an already-completed check-out behave exactly as they do now — no extra prompt.

**Worker/admin manual actions (Bible School attendance tab)**
- The "Time-out" button asks for confirmation naming the student before recording the time-out.
- The "Clear out" button (which erases an existing time-out) also asks for confirmation.

## Technical notes

- Update the `wofbi_checkin` database function to take a new optional `_confirm_checkout boolean default false` argument. When an open record exists and the flag is false, it returns `{ ok: true, action: 'confirm_checkout', checked_in_at, session_title, session_date }` without writing anything. When true, it performs the existing check-out. All other branches are unchanged; execute grant re-applied for `authenticated`.
- `src/pages/WoFBICheckin.jsx`: handle the new `confirm_checkout` action by rendering the warning state, with the confirm button re-calling the RPC with `_confirm_checkout: true`.
- `src/components/exams/WoFBIAttendanceTab.jsx`: wrap the `set_time_out` and `clear_time_out` actions in a confirmation dialog (simple AlertDialog — these are attendance timestamp edits, not record deletions, so no password re-entry).
