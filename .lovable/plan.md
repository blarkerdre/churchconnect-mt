

## Plan: Make "Delete All Data" Tenant-Scoped

### Problem
The `purge-all-data` Edge Function deletes data across ALL tenants. It should only purge data for the current tenant.

### Changes

**1. Frontend: `src/components/settings/DangerZoneSection.jsx`**
- Import `useTenantQuery` hook to get the current `tenantId`
- Pass `tenant_id` in the request body alongside `password`

**2. Edge Function: `supabase/functions/purge-all-data/index.ts`**
- Accept `tenant_id` from the request body
- Validate the caller belongs to that tenant and has `super_admin` role
- Scope ALL delete operations with `.eq("tenant_id", tenant_id)` instead of `.neq("id", ...)`
- Scope user deletion: only delete auth users who belong to the tenant (via `tenant_memberships`) and are not the acting admin
- Scope storage cleanup: only delete files prefixed with the tenant_id (if applicable)
- Keep the acting admin's profile, role, and tenant membership intact

### Technical Details

Delete queries change from:
```js
// Before (deletes everything)
await adminClient.from("members").delete().neq("id", "00000000-...");

// After (tenant-scoped)
await adminClient.from("members").delete().eq("tenant_id", tenant_id);
```

For user account deletion, query `tenant_memberships` for the tenant first, then delete only those auth users (excluding the caller):
```js
const { data: tenantUsers } = await adminClient
  .from("tenant_memberships")
  .select("user_id")
  .eq("tenant_id", tenant_id)
  .neq("user_id", actingUserId);
```

No database migrations needed.

