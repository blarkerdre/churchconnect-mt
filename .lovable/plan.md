## Show unit name and created-by for unit meetings

Extend the Attendance page so that every **Unit Meeting** and **Home Cell Meeting** in the meeting list clearly shows the church unit it belongs to and the person who created it.

### Database
- Add a foreign key on `attendance_sessions.created_by` referencing `profiles(user_id)`.
  - This enables Supabase's `profiles:created_by(full_name)` join syntax, which is already used by the `announcements` table.
  - No new columns needed — `created_by` already exists.

### Frontend — `src/pages/Attendance.jsx`

1. **Capture creator on insert**
   - Destructure `user` from `useAuth()`.
   - In `createSessionMutation`, add `created_by: user?.id` to the payload alongside the existing fields.

2. **Fetch creator names**
   - Change the `attendance_sessions` select from `*` to `*, profiles:created_by(full_name)`.
   - This returns `profiles.full_name` for each session (null when `created_by` is empty).

3. **Display in the meeting list**
   - In the "All Meetings" card, for each session button, add a third info line:
     - Show the unit name when `s.unit` exists (e.g. "Youth Unit").
     - Show "Created by {name}" when `s.profiles?.full_name` exists.
     - Combine them as: `{s.unit} · Created by {full_name}`.
   - For non-unit meetings (Sunday Service, etc.) the unit line remains hidden, preserving existing layout.

### Files touched
- `src/pages/Attendance.jsx` (query, mutation, and list UI)
- Database migration for the foreign key

### Out of scope
- No changes to `SessionFormDialog.jsx` (it only collects form data).
- Existing meeting types that have no `unit` value are visually unchanged apart from adding the creator name when available.