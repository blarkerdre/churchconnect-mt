

## Fix: Users Scanned from WCI Cardiff QR Linked to Demo Church

### Root cause

When a user scans a WCI Cardiff QR code and registers, two things happen:

1. **Member record** — correctly created in WCI Cardiff's tenant (the edge function passes the right `tenant_id`). This works fine.

2. **User account** (profile + primary tenant) — created by the `handle_new_user` database trigger when they first signed up. If they signed up at `/auth` without a tenant slug (before the redirect fix), or if the trigger couldn't resolve a slug, it defaulted to Demo Church (`d8bbbdae-...`). The `profiles.tenant_id` was set to Demo Church and never updated.

The `ensureTenantAccess()` function in `public-register` adds a `tenant_memberships` row for the correct tenant, but **does not update `profiles.tenant_id`**. So the user's primary context remains Demo Church.

### Fix

**1. `supabase/functions/public-register/index.ts`** — Update `ensureTenantAccess()` to also update `profiles.tenant_id` when the current value is the DEFAULT_TENANT_ID and the registration is for a different tenant:

```ts
// Inside ensureTenantAccess, after upserting memberships:
if (tenantId !== DEFAULT_TENANT_ID) {
  await supabase
    .from("profiles")
    .update({ tenant_id: tenantId })
    .eq("user_id", userId)
    .eq("tenant_id", DEFAULT_TENANT_ID);
}
```

This ensures that when a user who defaulted to Demo Church registers via a real church's QR code, their profile gets corrected.

**2. Migration** — Backfill existing users whose profile says Demo Church but whose member record is in a different tenant:

```sql
UPDATE profiles p
SET tenant_id = m.tenant_id
FROM members m
WHERE m.user_id = p.user_id
  AND p.tenant_id = 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'
  AND m.tenant_id IS NOT NULL
  AND m.tenant_id != 'd8bbbdae-d9b3-4999-912d-3aa5999884b0';
```

### Files changed
- `supabase/functions/public-register/index.ts` — update `ensureTenantAccess` to fix profile tenant_id
- 1 new migration — backfill mismatched profile tenant_ids

