# Show date and time on Members, Users and Follow-ups

Add a consistent "when it happened" timestamp (format: `14 Aug 2026, 14:13`) to the members directory, member profile view, user management list, and follow-ups.

## What changes

### Members list
- New "Added" column in the members table showing the record creation date and time.
- Column hidden on small screens so the table still fits; the timestamp also appears under the member name on mobile.

### Member profile / edit view
- A small line at the top of the member dialog showing "Added on ..." and "Last updated ..." when viewing an existing member.

### User Management list
- New "Joined" column showing when the user account/profile was created, with the same date and time format.

### Follow-ups
- Each follow-up card shows "Created ..." with date and time alongside the existing due date.
- The follow-up detail panel shows Created and Last updated timestamps, and the completed date gains its time.
- CSV export gains a "Created" column with the same format.

## Technical notes

- Use `date-fns` `format(new Date(value), "dd MMM yyyy, HH:mm")`, matching the existing pattern already used in `FollowupDetailPanel.jsx`.
- Add one small shared helper (e.g. `formatDateTime` in `src/lib/utils.js`) that returns `—` for missing values, and use it everywhere so formats stay identical.
- Files touched: `src/components/members/MemberTable.jsx`, `src/components/members/MemberFormDialog.jsx`, `src/pages/UserManagement.jsx`, `src/pages/Followups.jsx`, `src/components/followups/FollowupDetailPanel.jsx`, `src/lib/utils.js`.
- Display only — no schema changes; `created_at` / `updated_at` already exist on these tables and are already fetched.
