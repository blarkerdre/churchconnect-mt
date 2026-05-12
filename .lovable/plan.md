## Why Ian appears

Ian Mutendebvure has `church_unit = NULL` and status `Visitor`, but he has an `attendance_records` row for the **Altar Minister** Unit Meeting on 2026-05-10. That record was likely created when he was previously assigned to Altar Minister; clearing his unit afterwards left the record orphaned.

The current `CheckInPanel` only filters the **eligible members list** by `church_unit`. It never checks whether existing attendance records belong to eligible members, so Ian:
- counts toward the "Present" stat,
- appears on downloaded/printed reports,
- but is invisible in the list (you can't un-check him from the UI).

There is also no server-side guard, so a stale or admin-side insert can attach any member to a Unit Meeting.

## Plan

### 1. `CheckInPanel.jsx` — fix display + cleanup
- Compute eligible member IDs once (`memberUnits` includes `session.unit`, case-insensitive).
- For Unit Meetings, also surface any `attendance_records` whose `member_id` is **not** in the eligible set as a small "Not in this unit" group at the top, each with a one-click **Remove** action so admins can clean stale entries (like Ian).
- Use only eligible-member records for the Total/Present/Absent stats and CSV export, so the numbers stop including off-unit check-ins.
- Block the green check button for non-eligible members.

### 2. `SelfCheckIn.jsx` — already guards eligibility (no change needed beyond reusing the same case-insensitive comparison helper).

### 3. Server-side guard (DB trigger via migration)
Add a `BEFORE INSERT` trigger on `attendance_records`: when the linked session is a Unit Meeting with a non-null `unit`, reject the insert if the member's `church_unit` (comma-split, case-insensitive) does not contain that unit. This prevents future orphaned rows regardless of UI path (admin panel, self check-in, imports).

### 4. Memory update
Append a note to `mem://features/unit-attendance` documenting the strict eligibility rule and trigger.

## Out of scope
- Home Cell (`wsf`) attendance — same pattern can follow later if desired.
- Bulk-deleting historical orphan records across all sessions (admins can clean them per-session via the new Remove button, or we can run a one-off cleanup if you confirm).

## Files
- `src/components/attendance/CheckInPanel.jsx`
- new migration adding `enforce_unit_attendance_eligibility` trigger
- `mem://features/unit-attendance`
