

## Plan: Events Scoping, Communications WSF Support, and Member Journey Tracking

Three changes (excluding auto-certificate generation as requested).

---

### 1. Database Migration

**Drop unused columns from events:**
```sql
ALTER TABLE public.events DROP COLUMN IF EXISTS target_unit;
ALTER TABLE public.events DROP COLUMN IF EXISTS target_wsf_centre_id;
```
No data exists in these columns (verified). Replace with an `audience` text column (default `'All Members'`) to match the announcements pattern.

**Add audience column to events:**
```sql
ALTER TABLE public.events ADD COLUMN audience text NOT NULL DEFAULT 'All Members';
```

**Create member_status_history table:**
```sql
CREATE TABLE public.member_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);
ALTER TABLE public.member_status_history ENABLE ROW LEVEL SECURITY;
-- RLS policies for admins/leaders to view, trigger inserts via SECURITY DEFINER
```

**Create trigger to track status changes:**
A BEFORE UPDATE trigger on `members` that inserts into `member_status_history` when `membership_status` changes.

**Update RLS on events and announcements** to allow WSF leaders to manage (INSERT/UPDATE/DELETE):
```sql
-- Events: add wsf_leader to the manage policy
DROP POLICY "Admins can manage events" ON public.events;
CREATE POLICY "Admins/leaders can manage events" ON public.events FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));

-- Same for announcements
DROP POLICY "Admins/leaders can manage announcements" ON public.announcements;
CREATE POLICY "Admins/leaders can manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role) OR has_role(auth.uid(), 'wsf_leader'::app_role));
```

---

### 2. Events.jsx Changes

- Remove `target_unit` and `target_wsf_centre_id` from form, payload, and filtering logic
- Replace with `audience` field — same AUDIENCES list as Communications
- **Unit leaders**: auto-lock audience to their unit name(s); can only create events for their unit
- **WSF leaders**: auto-lock audience to their WSF centre name; can only create events for their centre members
- **Admins**: can select any audience freely
- Filter events list: unit leaders see `All Members` + their unit events; WSF leaders see `All Members` + their centre events
- Display audience badge on event cards
- Keep event_mode, start/end time, date, location fields

---

### 3. Communications.jsx Changes

- Add WSF leader support: `canManageComms` includes `isWSFLeader`
- Fetch WSF centre names for WSF leaders (reuse pattern from Events)
- WSF leaders' available audiences = their WSF centre names
- WSF leaders' locked audience = their centre name if they lead exactly one centre

---

### 4. Member Journey Tracking UI

**MemberFormDialog.jsx**: Add a "Member Journey" section showing timeline from `member_status_history` table when viewing/editing a member. Shows progression like "First Timer → New Convert (15 Jan 2026)" with dates.

**MyProfile.jsx**: Same timeline view for member's own profile.

Both query `member_status_history` by `member_id` ordered by `changed_at`.

---

### Files Changed Summary

| File | Changes |
|------|---------|
| DB migration | Drop target_unit/target_wsf_centre_id, add audience to events, create member_status_history + trigger, update RLS |
| `Events.jsx` | Replace target_unit/wsf with audience-based scoping, WSF leader support |
| `Communications.jsx` | Add WSF leader support, WSF centre audience scoping |
| `MemberFormDialog.jsx` | Add member journey timeline section |
| `MyProfile.jsx` | Add member journey timeline section |

