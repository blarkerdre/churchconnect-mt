## Goal
Let an admin create one attendance session that **every member in the tenant** can self-check-in to today (e.g. Sunday Service).

## Current state
- `SelfCheckInWidget` already shows a "Check In" button to every member for any session **without a `unit`** dated today (Sunday Service, Midweek Service, Special Event, Prayer Meeting).
- `SessionFormDialog` already supports those types — but the audience behaviour is implicit, so admins can't tell who will see the session.

## What changes
Make the audience choice **explicit and obvious** in `SessionFormDialog`, without changing the data model.

1. **Add an "Audience" section** to `SessionFormDialog` with two options:
   - **All members** (default) — clears `unit`/centre, session shows for every tenant member.
   - **Specific unit / Home Cell** — only shown when the type is *Unit Meeting* or *Home Cell Meeting*.
2. **Add the missing session types** so the form matches what the widget understands:
   - Add `Special Service`, `Bible School`, `Home Cell Meeting`, `Other` to `SESSION_TYPES`.
3. **Show a live audience badge** under the Audience picker, e.g.
   - "Visible to all members in this church" or
   - "Visible to members of *Choir* unit" / "Visible to members of *Cardiff Central* Home Cell".
4. **Empty-state copy** in `SessionFormDialog` when admin picks Home Cell Meeting but no centres exist — link to settings.
5. **No DB / RLS changes.** The widget logic already covers this case correctly.

## Files touched
- `src/components/attendance/SessionFormDialog.jsx` — audience UI, expanded types, helper text.

## Out of scope
- Bulk "mark all present" on an existing session.
- Recurring/auto-generated sessions.
- Notifications when a session opens (separate request).
