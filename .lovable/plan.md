

## Notify WSF Leader on Centre Selection (In-App + Email + SMS)

### Current state
- `notifyWSFLeader()` in `public-register/index.ts` sends only an **in-app notification** and only fires during **public registration**
- When a member selects a WSF centre via **MyProfile**, **MemberFormDialog**, or **Onboard**, the WSF leader gets **no notification at all**
- The `wsf_centres` table has a `leader_id` column (references a member ID), and the leader's `user_id` is obtained via the `members` table

### Approach
Use a **database trigger** on `members` table (`AFTER INSERT OR UPDATE`) that fires when `wsf_centre_id` changes (or is set on insert). This covers all paths — public registration, self-service profile, admin edits — in one place.

### Implementation

#### 1. Database migration — trigger function + trigger

Create `notify_wsf_leader_on_centre_selection()`:
- Fires on INSERT (when `NEW.wsf_centre_id IS NOT NULL`) or UPDATE (when `wsf_centre_id` changes)
- Looks up the WSF centre's `leader_id` → gets `user_id` from `members`
- Inserts an **in-app notification** for the leader
- Calls `notify-pastoral-assignment`-style HTTP POST to a new edge function `notify-wsf-leader` for **email + SMS**

#### 2. New edge function: `supabase/functions/notify-wsf-leader/index.ts`

Accepts: `leader_user_id`, `member_name`, `centre_name`, `centre_id`, `tenant_id`

Actions:
- Looks up the leader's email and phone from `members` table (scoped by tenant)
- Sends **email** via `send-transactional-email` using a simple notification template (or inline HTML)
- Sends **SMS** via existing Twilio gateway (if SMS enabled for tenant)
- Logs SMS to `sms_log`

#### 3. Remove duplicate `notifyWSFLeader()` from `public-register/index.ts`

The DB trigger now handles all paths, so the manual call in the edge function becomes redundant. Remove the function and its calls to avoid double-notifications.

### Migration SQL (key shape)

```sql
CREATE OR REPLACE FUNCTION public.notify_wsf_leader_on_centre_selection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _centre record;
  _leader_user_id uuid;
  _member_name text;
  _supabase_url text;
  _service_key text;
BEGIN
  -- Only fire when wsf_centre_id is set/changed
  IF TG_OP = 'INSERT' AND NEW.wsf_centre_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.wsf_centre_id IS NOT DISTINCT FROM OLD.wsf_centre_id) THEN RETURN NEW; END IF;
  IF NEW.wsf_centre_id IS NULL THEN RETURN NEW; END IF;

  SELECT leader_id, name INTO _centre FROM wsf_centres WHERE id = NEW.wsf_centre_id;
  IF _centre.leader_id IS NULL THEN RETURN NEW; END IF;

  SELECT user_id INTO _leader_user_id FROM members WHERE id = _centre.leader_id;
  IF _leader_user_id IS NULL THEN RETURN NEW; END IF;

  _member_name := NEW.first_name || ' ' || NEW.last_name;

  -- In-app notification
  INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, tenant_id)
  VALUES (_leader_user_id, 'New Member Joined Your WSF Centre',
    _member_name || ' has selected your WSF centre: ' || _centre.name,
    'general', 'wsf_centre', NEW.wsf_centre_id::text, NEW.tenant_id);

  -- Email + SMS via edge function
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/notify-wsf-leader',
      body := jsonb_build_object(
        'leader_user_id', _leader_user_id,
        'member_name', _member_name,
        'centre_name', _centre.name,
        'centre_id', NEW.wsf_centre_id,
        'tenant_id', NEW.tenant_id
      )::text,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wsf_leader_centre_selection
AFTER INSERT OR UPDATE OF wsf_centre_id ON public.members
FOR EACH ROW EXECUTE FUNCTION notify_wsf_leader_on_centre_selection();
```

### Edge function: `notify-wsf-leader/index.ts`

- Auth: accepts service role key
- Looks up leader's phone + email from `members` (scoped by tenant)
- Sends email with subject "New Member Joined Your WSF Centre" and simple HTML body
- Sends SMS: "{member_name} has joined your WSF centre: {centre_name}"
- Respects tenant SMS toggle (`app_settings` → `sms_notifications_enabled`)

### Cleanup in `public-register/index.ts`

- Remove `notifyWSFLeader()` function definition (lines 136-168)
- Remove all calls to `notifyWSFLeader()` throughout the file
- The trigger now handles this automatically

### Files changed
1. **New migration** — trigger function + trigger on `members`
2. **New edge function** — `supabase/functions/notify-wsf-leader/index.ts`
3. **Edit** — `supabase/functions/public-register/index.ts` — remove redundant `notifyWSFLeader`

### Expected result
Whenever a member selects or changes their WSF centre (from any path — registration, profile, admin edit), the centre's leader receives an in-app notification, email, and SMS.

