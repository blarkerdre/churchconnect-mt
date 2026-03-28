

## Fix: Tenant Admin Invite Flow — Issues & Email Not Working

### Issues Found

#### 1. CRITICAL: `invite-to-tenant` site URL hardcoded to old domain
**Line 125** of `supabase/functions/invite-to-tenant/index.ts`:
```
const siteUrl = "https://churchconnect-mt.lovable.app";
```
Should be `https://app.churchmanagementsuite.org`. The invitation email contains a signup link pointing to the old Lovable preview domain, which may not resolve correctly or confuse users.

#### 2. CRITICAL: `invite-to-tenant` not in `config.toml`
The function is not listed in `supabase/config.toml`, meaning it deploys with default settings (`verify_jwt = true`). However, the function manually validates the JWT via `supabase.auth.getUser(token)`, so the gateway's JWT check may reject service-role calls. This is fine for user-initiated calls but worth noting. The bigger issue is that the function may not have been **redeployed** after recent changes — edge function logs show **zero logs**, meaning either it was never called or never deployed.

#### 3. `is_admin` call is not tenant-scoped
**Line 33**: `supabase.rpc("is_admin", { _user_id: caller.id })` uses the single-arg overload which checks if the user is admin in **any** tenant. A church admin in Tenant A could invite users to Tenant B. Should use the two-arg overload with `_tenant_id: tenant_id`.

#### 4. `invite-to-tenant` doesn't pass `tenant_id` to email
The `send-transactional-email` invocation on line 128 doesn't include `tenant_id` in the body, so the email log will have `tenant_id = NULL` — the same issue we just fixed in all other email functions.

#### 5. `TenantUsersDialog` — missing tenant isolation on mutations
- **Line 93-94**: `updateRoleMutation` updates by `membershipId` only, no `.eq("tenant_id", tenant.id)`
- **Line 108-111**: `removeMutation` deletes by `membershipId` only, no `.eq("tenant_id", tenant.id)`
- **Line 128-129**: `cancelInviteMutation` updates by `invitationId` only, no `.eq("tenant_id", tenant.id)`

#### 6. Pending invitation exists but email never arrived
`odunsi.temitayo16@gmail.com` has a pending invitation for wci-cardiff created 2026-03-27. The email likely failed because the function wasn't redeployed after recent changes or the old domain URL was used.

### Plan

#### 1. Fix `invite-to-tenant` edge function
- Change `siteUrl` to `https://app.churchmanagementsuite.org`
- Change `is_admin` RPC call to use 2-arg overload: `{ _user_id: caller.id, _tenant_id: tenant_id }`
- Add `tenant_id` to the `send-transactional-email` invocation body
- Add request-level logging for debugging

#### 2. Harden `TenantUsersDialog` mutations
- Add `.eq("tenant_id", tenant.id)` to `updateRoleMutation`, `removeMutation`, and `cancelInviteMutation`

#### 3. Redeploy `invite-to-tenant`

### Files to change
- `supabase/functions/invite-to-tenant/index.ts`
- `src/components/tenants/TenantUsersDialog.jsx`

