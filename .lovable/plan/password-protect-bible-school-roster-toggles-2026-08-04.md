# Password-protect Bible School roster toggles

Prevent accidental attendance changes in the Bible School roster dialog by requiring the signed-in user's account password before each manual override.

## What changes

In the Bible School → Attendance → Roster dialog, every manual override now asks for the account password first:

- Present / Late / Absent buttons
- Punctuality star rating
- Time-out and Clear out (the existing time-out warning stays, with the password step added)

Flow: tap a button → password dialog appears showing what is about to change (student name and new status) → enter password → change is applied. Wrong password shows an error and nothing is saved. Cancel leaves the record untouched.

Password is requested on every edit, as requested.

## Technical notes

- Reuse the existing `PasswordConfirmDialog` (`src/components/shared/PasswordConfirmDialog.jsx`), which already re-authenticates via the current user's email and password.
- In `src/components/exams/WoFBIAttendanceTab.jsx`, add a single `pendingRosterEdit` state holding the intended `markStatus.mutate` payload plus a human-readable description. Roster buttons set this state instead of calling `mutate` directly; the dialog's `onConfirm` runs the mutation.
- The existing `timeOutConfirm` AlertDialog routes into the same password step rather than mutating directly.
- Non-destructive wording: dialog title "Confirm attendance change", confirm label "Apply change", styled from the shared component (its default destructive styling is fine, or a neutral variant prop can be added).
- No database, RLS, or query changes — this is a client-side confirmation gate only.
