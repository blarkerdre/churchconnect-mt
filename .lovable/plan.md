# Why members are flipping to Inactive

## What is happening

Every time a unit meeting register is closed, the system automatically marks people Inactive. In Winners Chapel International, Cardiff this has fired repeatedly: 73 people on 6 Sep, 27 more on 20 Sep, plus smaller batches on 13 and 20 Sep. All of them went from Active to Inactive with no one touching their record.

## Why it is wrong

The automatic rule was meant to say "if someone missed the last three meetings of their unit, mark them Inactive". In practice it does something much blunter:

1. It ignores which unit a person belongs to. When one unit closes its register, everyone in the whole church who wasn't on that register gets caught.
2. It only recognises registers whose status was saved with a capital "C". Only 3 of the 111 closed unit meetings match, and those three are from three different units, one dating back to March. So "the last three meetings" is effectively a fixed, stale list that almost nobody appears on.
3. It applies to anyone who has ever been marked present at anything, so long-standing members get swept in.

Put together: closing any register re-marks most of the church Inactive.

## The fix

1. Stop the automatic rule from running, so no further members are changed while the correction is applied.
2. Restore the people it wrongly changed — every member switched Active to Inactive by the automation (not by a person) goes back to Active, using the recorded status history so genuine manual changes are left alone.
3. Rebuild the rule properly, then switch it back on:
   - only consider meetings of the unit the member actually belongs to
   - treat closed as closed regardless of how it was typed
   - require three genuinely recent closed meetings of that unit before anything changes
   - only consider people who were expected at those meetings
4. Confirm afterwards: counts of Active and Inactive per church, and a check that closing a register no longer changes anyone unexpectedly.

## Optional

If you would rather not have any automatic inactivation at all, step 3 can be dropped and the rule removed entirely, leaving status changes fully manual. Say which you prefer.

## Technical details

- Trigger `trg_check_inactivation` on `attendance_sessions` (AFTER UPDATE, `new.status = 'Closed'`) calling `check_attendance_inactivation()`.
- The function picks the top 3 `attendance_sessions` with `status = 'Closed'` (case-sensitive; 108 rows store `closed`), with no `unit` filter, then sets `membership_status = 'Inactive'` for every Active member of the tenant having any `attendance_records` row but none in those 3 sessions.
- Repair uses `member_status_history` rows where `previous_status = 'Active'` and `new_status = 'Inactive'` at the automation timestamps to revert `members.membership_status`.
- Rewritten function: normalise with `lower(status) = 'closed'`, scope candidate sessions by `unit` matching the member's `church_unit`, restrict to sessions within a recent window, and skip tenants with fewer than 3 qualifying sessions for that unit.
