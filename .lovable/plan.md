

## Fix: `admin-create-user` Not Linking to the Correct Tenant

### Root cause

When `admin-create-user` calls `supabase.auth.admin.createUser()`, the database trigger `handle_new_user` fires automatically. This trigger resolves the tenant by:
1. Looking for a **pending invitation** matching the email — if a stale invitation exists for a **different tenant**, it links to that tenant instead
2. Checking `user_metadata.tenant_slug` — but the edge function **never passes this**, so it's always null

The edge function then does its own profile upsert and tenant membership insert with the correct `tenant_id`, but the trigger has already:
- Created a `tenant_memberships` row for the **wrong** tenant
- Created a `user_roles` row for the **wrong** tenant
- Marked the stale invitation as "accepted"

The user ends up with memberships in both tenants, but the **first** one (from the trigger) becomes the default in `TenantContext`, sending them to the wrong church.

### Fix

**`supabase/functions/admin-create-user/index.ts`** — pass the caller's `tenant_id` in user metadata so the trigger resolves correctly:

1. Look up the tenant slug from the provided `tenant_id` before creating the user
2. Pass `tenant_slug` in `user_metadata` when calling `createUser()`:
   ```ts
   user_metadata: { full_name: normalizedFullName, tenant_slug: tenantSlug }
   ```
3. This ensures the `handle_new_user` trigger resolves the correct tenant even if stale invitations exist (invitations are checked first, but with the slug as a reliable fallback)

Additionally, to prevent stale invitations from hijacking tenant resolution, update the `handle_new_user` trigger:
- When a `tenant_slug` is present in metadata, **prioritize it over pending invitations** — or at minimum, only accept invitations that match the same tenant

### Migration

Update `handle_new_user()` to check the slug-resolved tenant first, then only accept invitations from that same tenant (or any invitation if no slug is provided). This prevents cross-tenant hijacking.

### Files changed
- `supabase/functions/admin-create-user/index.ts` — resolve tenant slug and pass it in `user_metadata`
- 1 new migration — update `handle_new_user()` to prioritize `tenant_slug` over stale invitations

