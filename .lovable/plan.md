

## Fix: Members Can't Complete Profile (RLS Blocking)

### Root Cause

When a user completes their profile via `CreateMemberProfile`, the `public-register` edge function creates/updates the member record using the service role key (bypasses RLS). However, **it never creates `tenant_memberships` or `user_roles` rows** for the authenticated user. 

After creation, when the page tries to read back the member record via the client-side query (line 133), RLS blocks it because `user_has_tenant_access(tenant_id)` returns `false` — the user has no `tenant_memberships` row. So the profile appears to never have been saved.

There is currently 1 orphaned member in this state.

### Fix

**1. `supabase/functions/public-register/index.ts`** — After creating/linking a member record for an authenticated user with a `tenant_id`, insert `tenant_memberships` and `user_roles` rows (with `ON CONFLICT DO NOTHING`):

```sql
INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES (..., ..., 'member') ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role, tenant_id) VALUES (..., 'member', ...) ON CONFLICT DO NOTHING;
```

This needs to happen in all three code paths: update existing linked member, claim by email, and fresh insert.

**2. Database migration** — Backfill the 1 existing orphaned record:

```sql
INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
SELECT m.user_id, m.tenant_id, 'member' FROM public.members m
WHERE m.user_id IS NOT NULL AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = m.user_id AND tm.tenant_id = m.tenant_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT m.user_id, 'member', m.tenant_id FROM public.members m
WHERE m.user_id IS NOT NULL AND m.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = m.user_id AND ur.role = 'member' AND ur.tenant_id = m.tenant_id)
ON CONFLICT DO NOTHING;
```

### Files changed

- **`supabase/functions/public-register/index.ts`** — add tenant_memberships + user_roles inserts after member create/update/claim
- **One database migration** — backfill existing orphaned records

