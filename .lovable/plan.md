

## Notify Unit Leaders When a Member Joins Their Unit (In-App + Email + SMS)

### Current state
- `church_unit` on `members` is a comma-separated text field (e.g. `"Choir, Ushering"`)
- `unit_leader_assignments` maps `user_id` + `unit_name` to identify unit leaders
- Currently, NO notification is sent to unit leaders when a member joins or leaves their unit
- The WSF leader notification trigger (`trg_wsf_leader_centre_selection`) already exists as a pattern to follow

### Implementation

#### 1. Database trigger on `members.church_unit` changes
Create `notify_unit_leaders_on_unit_change()` trigger function:
- Fires `AFTER INSERT OR UPDATE OF church_unit`
- Compares old vs new comma-separated unit list to find **newly added** units
- For each new unit, looks up leaders from `unit_leader_assignments` matching that unit name and tenant
- Inserts an **in-app notification** for each leader
- Calls the existing `notify-wsf-leader` edge function (repurposed/extended) OR a new `notify-unit-leader` edge function for email + SMS

#### 2. New edge function: `notify-unit-leader/index.ts`
Accepts: `leader_user_id`, `member_name`, `unit_name`, `tenant_id`
- Looks up leader's email and phone
- Sends email: "New Member Joined Your Unit: {unit_name}"
- Sends SMS: "{member_name} has joined your unit: {unit_name}"
- Respects tenant SMS toggle
- Logs to `email_send_log` and `sms_log`

Same structure as `notify-wsf-leader` with adjusted copy.

#### 3. Trigger SQL shape
```sql
CREATE OR REPLACE FUNCTION public.notify_unit_leaders_on_unit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _old_units text[];
  _new_units text[];
  _added_unit text;
  _leader record;
  _member_name text;
  _supabase_url text;
  _service_key text;
BEGIN
  -- Parse comma-separated units into arrays
  _old_units := string_to_array(COALESCE(NULLIF(TRIM(OLD.church_unit), ''), ''), ',');
  _new_units := string_to_array(COALESCE(NULLIF(TRIM(NEW.church_unit), ''), ''), ',');
  -- Trim whitespace from each element
  -- Find newly added units and notify leaders for each

  FOR each newly added unit:
    - Query unit_leader_assignments for matching unit_name + tenant
    - Insert in-app notification for each leader
    - Call notify-unit-leader edge function for email+SMS
END;
$$;
```

### Files changed
1. **New migration** — trigger function + trigger on `members` for `church_unit` changes
2. **New edge function** — `supabase/functions/notify-unit-leader/index.ts`

### Expected result
Whenever a member joins a unit (from any path — admin edit, profile, onboarding), all leaders of that unit receive in-app + email + SMS notifications.

