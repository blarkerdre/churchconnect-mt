

## In-App Notifications for Events, Announcements, Meetings & Attendance

### Current state
- **Announcements** (`trg_new_announcement`): notifies ALL tenant users when published — not scoped by `target_audience`
- **Events** (`trg_new_event`): notifies ALL tenant users on insert — not scoped by `audience`
- **Meetings** (attendance sessions): NO notification trigger exists
- **Attendance**: NO notification when a meeting is closed or report saved

### What needs to change

#### 1. Scope announcement notifications by `target_audience`
Update `notify_new_announcement()` to check `NEW.target_audience`:
- `"All Members"` → notify all tenant users (current behavior)
- Specific unit/centre name → notify only members whose `church_unit` contains that value, or whose `wsf_centre_id` matches a centre with that name
- `"Leaders Only"` → notify only users with `unit_leader` or `wsf_leader` roles in the tenant

#### 2. Scope event notifications by `audience`
Update `notify_new_event()` to check `NEW.audience`:
- `"All Members"` → notify all tenant users
- Specific unit name → notify members in that unit
- `"WSF"` → notify all members with a `wsf_centre_id`
- `"WSF Leaders"` → notify WSF leaders only
- `"Leaders Only"` → notify unit + WSF leaders
- Specific centre name → notify members in that centre

#### 3. New trigger: notify unit members on new meeting
Create `notify_new_meeting()` trigger on `attendance_sessions` `AFTER INSERT`:
- If `session_type = 'Unit Meeting'` and `unit` is set → notify members whose `church_unit` contains that unit name + unit leaders for that unit
- If `session_type` is a general meeting (Sunday Service, etc.) → notify all tenant users

#### 4. New trigger: notify on meeting closed
Create `notify_meeting_closed()` trigger on `attendance_sessions` `AFTER UPDATE OF status`:
- When status changes to `'Closed'` → notify unit leaders (for unit meetings) or admins (for general meetings) that the meeting has been closed with attendance count

### Migration SQL
One new migration that:
1. Replaces `notify_new_announcement()` with audience-scoped logic
2. Replaces `notify_new_event()` with audience-scoped logic
3. Creates `notify_new_meeting()` + trigger on `attendance_sessions` INSERT
4. Creates `notify_meeting_closed()` + trigger on `attendance_sessions` UPDATE

All functions use `SECURITY DEFINER` with `search_path = public` and scope all lookups by `NEW.tenant_id`.

### Technical approach
Instead of `notify_all_users()`, the scoped functions will directly insert into `notifications` by joining against:
- `members` (for unit/centre matching) → get `user_id`
- `unit_leader_assignments` (for leader-only targeting)
- `wsf_centres` (for centre name matching)
- `tenant_memberships` (for "all members" fallback)

### Files changed
1. **New migration** — recreate announcement + event trigger functions with audience scoping; add two new meeting/attendance trigger functions + triggers

No frontend or edge function changes needed — notifications already display via the existing `NotificationBell` component with realtime subscription.

