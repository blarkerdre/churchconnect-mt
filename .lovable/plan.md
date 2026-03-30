

## Fix: Assigned Follow-up Member Not Receiving Email/SMS

### Problem
The `auto_create_followup` trigger correctly targets only the assigned user for email/SMS (which is what you want). However, the edge function `notify-followup-assignment` is **never being called** — there are zero logs for it. This means the vault secret `supabase_url` is missing, causing the `IF _supabase_url IS NOT NULL` check to fail silently.

### Current behavior (correct logic, broken delivery)
- Follow-up task is created and assigned to one user via round-robin
- All follow-up unit members get **in-app notifications** (working)
- Only the **assigned user** should get email/SMS via `notify-followup-assignment` (correct intent, but the call never fires)

### Root cause
The trigger reads `supabase_url` from `vault.decrypted_secrets`. This secret was never inserted, so `_supabase_url` is NULL and the `http_post` call is skipped entirely.

### Fix
**1 database migration** — Insert the `supabase_url` vault secret so the trigger can resolve the edge function URL:

```sql
INSERT INTO vault.secrets (name, secret)
VALUES ('supabase_url', 'https://qfordhikmtgedfybktjg.supabase.co')
ON CONFLICT (name) DO NOTHING;
```

No changes to the trigger function or edge function — the current logic already sends email/SMS only to the assigned user.

### Files changed
- 1 migration — insert `supabase_url` vault secret

