

## Fix: Follow-up SMS notification not sending — missing `tenant_id`

### Root Cause
The `auto_create_followup` database trigger calls `notify-followup-assignment` via `http_post` but does **not include `tenant_id`** in the JSON body. The edge function receives `tenant_id = undefined`, so:

1. Tenant settings (custom Twilio numbers, sender name) are never loaded
2. The `app_settings` SMS-enabled check is not tenant-scoped (minor, but contributes to incorrect behavior)
3. The `sms_log` entry has no `tenant_id`, so it won't appear in tenant-scoped System Logs

Additionally, the member record lookup (`eq("user_id", assigned_to)`) may return a member from the wrong tenant if the user exists in multiple tenants. It should also be scoped by `tenant_id`.

### Fix

**1. Database migration** — Update `auto_create_followup` to include `tenant_id` in the `http_post` body:

```sql
body := jsonb_build_object(
  'assigned_to', _assigned_user,
  'member_name', NEW.first_name || ' ' || NEW.last_name,
  'description', _desc,
  'followup_id', _followup_id::text,
  'followup_type', _type,
  'tenant_id', NEW.tenant_id    -- ADD THIS
)::text,
```

**2. Edge function** — In `notify-followup-assignment/index.ts`, scope the member record lookup by `tenant_id` when available:

```ts
// Current (may match wrong tenant):
.eq("user_id", assigned_to).single();

// Fixed:
let memberQuery = supabase.from("members").select("phone, email, first_name").eq("user_id", assigned_to);
if (tenant_id) memberQuery = memberQuery.eq("tenant_id", tenant_id);
const { data: memberRecord } = await memberQuery.single();
```

Also scope the SMS-enabled check:
```ts
let smsQuery = supabase.from("app_settings").select("value").eq("key", "sms_notifications_enabled");
if (tenant_id) smsQuery = smsQuery.eq("tenant_id", tenant_id);
const { data: smsSetting } = await smsQuery.maybeSingle();
```

### Files changed
1. **New database migration** — recreate `auto_create_followup` with `tenant_id` in the HTTP body
2. **`supabase/functions/notify-followup-assignment/index.ts`** — scope member + SMS setting queries by `tenant_id`

### Expected result
When a First Timer or New Convert triggers a follow-up, the assigned member receives an SMS (if enabled and their phone is valid), and the log entry is correctly tagged with the tenant.

