

## Tenant Isolation Gaps in Email, SMS & WhatsApp

### Findings

Both edge functions have **cross-tenant authorization vulnerabilities** — they verify the user is an admin/leader globally but never confirm the user belongs to the specific tenant they're sending to.

#### 1. `send-email-alert` Edge Function
- **Line 76**: Uses `is_admin(user.id)` (single-arg) — returns true if admin in ANY tenant
- **Line 77-80**: Uses `has_role(user.id, 'unit_leader')` (no tenant) — same issue
- **No tenant access validation**: The function accepts `tenant_id` from the client and queries members by it, but never checks `user_has_tenant_access(tenant_id)`. An admin in Tenant A could pass Tenant B's `tenant_id` and email all of Tenant B's members.

#### 2. `send-sms` Edge Function (also used for WhatsApp)
- **Lines 51-60**: Queries `user_roles` directly without tenant filter — any admin/unit_leader in any tenant passes the check
- **No tenant access validation**: Same as above — accepts `tenant_id` from client, queries members by it, but never verifies the caller belongs to that tenant

### Fix

Update both edge functions to validate tenant access using the service client:

**`send-email-alert/index.ts`:**
- Replace the single-arg `is_admin`/`has_role` calls with tenant-scoped variants: `is_admin(user.id, tenant_id)` and `has_role(user.id, 'unit_leader', tenant_id)`
- Add early validation: if `tenant_id` is provided, verify user has tenant access before proceeding

**`send-sms/index.ts`:**
- Replace direct `user_roles` query with tenant-scoped RPC calls: `is_admin(user.id, tenant_id)` and `has_role(user.id, 'unit_leader', tenant_id)`
- Also check `is_tenant_admin(user.id, tenant_id)` to cover tenant membership roles
- Add early validation: if `tenant_id` is provided, verify user belongs to that tenant

### Client-side code

- `EmailAlertForm.jsx` — already passes `tenant_id: tenantId` ✓
- `SMSDialog.jsx` — already passes `tenant_id: tenantId` ✓
- `Communications.jsx` — uses `scopeQuery` and `withTenant` for announcements ✓

No client-side changes needed.

### Files changed

- **`supabase/functions/send-email-alert/index.ts`** — tenant-scoped auth checks
- **`supabase/functions/send-sms/index.ts`** — tenant-scoped auth checks

Both functions will be redeployed after changes.

