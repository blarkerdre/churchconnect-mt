

## Fix: Invitation Emails Failing with 401

### Root Cause
The `invite-to-tenant` edge function calls `send-transactional-email` via `supabase.functions.invoke()`. However, `send-transactional-email` has `verify_jwt = true` in `supabase/config.toml`. The service-role client used by `invite-to-tenant` passes the service_role key as a Bearer token, but Supabase's gateway JWT verification rejects it because it's not a standard user JWT — resulting in a **401 Unauthorized**.

This means:
- No email is sent (invitation or auto-add notification)
- No pending invitation appears in the Invitations tab (for new users, the invitation record IS created but the email fails silently)
- For existing users being auto-added, the email notification silently fails

### Fix
**File: `supabase/config.toml`** — Set `verify_jwt = false` for `send-transactional-email` so it can be called from other edge functions using the service role client.

The function already has internal authorization via the Supabase gateway (anon key required) and the service role client is trusted. This is consistent with how other inter-function calls work in the project.

```toml
[functions.send-transactional-email]
verify_jwt = false
```

Then **redeploy** `send-transactional-email` and `invite-to-tenant` to pick up the config change.

### Files changed
1. **`supabase/config.toml`** — change `verify_jwt` to `false` for `send-transactional-email`
2. Redeploy both `send-transactional-email` and `invite-to-tenant`

### After the fix
- Test by inviting a new email from Tenant Admin
- Verify the invitation email arrives and a pending invitation appears in the Invitations tab

