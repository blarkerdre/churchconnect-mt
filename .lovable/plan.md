

## Fix: Signup Fails Even With Tenant Slug

### Root Cause
The `handle_new_user()` trigger has a bug in its invitation lookup. After resolving `_tenant_id` from the slug (line: `SELECT id INTO _tenant_id FROM tenants WHERE slug = _slug`), the next query:

```sql
SELECT ti.tenant_id, ti.id, ti.role INTO _tenant_id, _inv_id, _inv_role
FROM public.tenant_invitations ti
WHERE ...
```

**overwrites `_tenant_id` with NULL** when no matching invitation exists. The `SELECT ... INTO` sets all target variables to NULL if no row is found. This destroys the tenant ID that was already resolved from the slug.

### Fix
Wrap the invitation lookups so they only overwrite `_tenant_id` when an invitation is actually found. Use intermediate variables or add `IF FOUND` guards.

### Migration SQL
Update the `handle_new_user()` function to preserve `_tenant_id` when no invitation matches:

```sql
-- After resolving _tenant_id from slug, use separate variables for invitation lookup
SELECT ti.tenant_id, ti.id, ti.role INTO _inv_tenant_id, _inv_id, _inv_role
FROM public.tenant_invitations ti
WHERE lower(ti.email) = lower(NEW.email)
  AND ti.status = 'pending'
  AND (_tenant_id IS NULL OR ti.tenant_id = _tenant_id)
ORDER BY ti.created_at DESC
LIMIT 1;

IF _inv_tenant_id IS NOT NULL THEN
  _tenant_id := _inv_tenant_id;
END IF;
```

Same pattern for the second invitation lookup block.

### Files changed
- **Database migration** — rewrite `handle_new_user()` to avoid overwriting `_tenant_id` on empty invitation results

