

## Plan: Member Self-Service Status, Follow-up Triggers, and Auto-Inactivation

### Overview
Three changes: (1) let members update their own membership status, (2) ensure follow-up triggers fire correctly for self-updates, and (3) automatically mark members inactive after 3 consecutive missed attendance sessions.

---

### 1. Allow members to update their own membership status

**Database migration:**
- Alter the `update_own_member_profile` RPC to accept a new `_membership_status` parameter
- Validate it's one of the allowed enum values (`First Timer`, `New Convert`, `Active`, `Inactive`)
- The existing `auto_create_followup` trigger on the `members` table fires on UPDATE, so changing status to First Timer or New Convert will automatically create a follow-up task with notifications

**Frontend — `src/pages/MyProfile.jsx`:**
- Add a "Membership Status" dropdown to both the edit form and the `CreateMemberProfile` form (currently hardcoded to "Active")
- Pass `_membership_status` to the RPC call in `updateMutation`
- Show all 4 status options: Active, Inactive, First Timer, New Convert

**Frontend — `src/pages/MyProfile.jsx` (CreateMemberProfile):**
- Add membership status selector (default: "First Timer") so new self-registrations can pick their status
- The direct insert already hits the `auto_create_followup` trigger

### 2. Ensure follow-up triggers fire for QR / public registration

The `public-register` edge function already manually creates follow-ups for First Timer / New Convert (lines 191-199). However, the `auto_create_followup` trigger also fires on the insert since it uses the service role. This could cause **duplicate follow-ups**.

**Fix in `supabase/functions/public-register/index.ts`:**
- Remove the manual follow-up insert (lines 191-199) since the database trigger already handles this automatically, including email/SMS notifications which the manual insert doesn't trigger

### 3. Auto-inactivate members after 3 consecutive missed sessions

**Database migration — create function + trigger:**
- Create a function `check_attendance_inactivation()` that runs after an attendance session is closed (status changed to "Closed")
- For each member who has attended at least one session historically, check if they missed the last 3 consecutive closed sessions
- If so, update their `membership_status` to "Inactive"
- Create a trigger on `attendance_sessions` that fires this function when `status` changes to "Closed"

```text
Logic:
1. Get the 3 most recent closed sessions
2. For each member who ever attended any session:
   - Check if they have records in ANY of the last 3 closed sessions
   - If they have ZERO records across all 3 → mark as Inactive
3. Only affect members currently marked as "Active"
```

---

### Technical details

**Migration SQL (summary):**

```sql
-- 1. Update RPC to include membership_status
CREATE OR REPLACE FUNCTION public.update_own_member_profile(
  ... existing params ...,
  _membership_status text DEFAULT NULL
) ...
  -- Add: membership_status = CASE WHEN valid THEN new_val ELSE keep END

-- 2. Auto-inactivation function
CREATE OR REPLACE FUNCTION public.check_attendance_inactivation()
  RETURNS trigger AS $$
  -- Find last 3 closed sessions
  -- Find active members who attended at least once historically
  -- but missed all 3 recent sessions → set Inactive
  $$;

CREATE TRIGGER trg_check_inactivation
  AFTER UPDATE ON public.attendance_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'Closed' AND OLD.status != 'Closed')
  EXECUTE FUNCTION public.check_attendance_inactivation();
```

**Files to edit:**
- `src/pages/MyProfile.jsx` — add membership status to edit form and create form
- `supabase/functions/public-register/index.ts` — remove duplicate follow-up insert

**New migration:**
- Update `update_own_member_profile` RPC with `_membership_status`
- Create `check_attendance_inactivation()` function and trigger

