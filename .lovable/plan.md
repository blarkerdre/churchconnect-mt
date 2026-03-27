

## Fix: Orphaned Member Record Visible Across Tenants

### Problem

The member **Odunsi Temitayo Ezekiel** (`fdbf7c80-6e79-4ae3-ad0e-9563d7ef2994`) has `tenant_id = NULL`. This makes it visible to admins in any tenant because the `is_admin(auth.uid(), tenant_id)` function receives NULL, and the RLS check doesn't properly exclude it.

This is the only orphaned member record in the database.

### Fix

One database migration to assign the orphaned record to the correct tenant, **or** delete it if it's a stale/test record.

**Option A — Assign to the correct tenant:**
```sql
UPDATE public.members
SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff')
WHERE id = 'fdbf7c80-6e79-4ae3-ad0e-9563d7ef2994'
  AND tenant_id IS NULL;
```

**Option B — Delete the orphaned record** (if it's not a real member).

Additionally, to prevent future orphans from being visible cross-tenant, a defensive RLS tightening could reject NULL `tenant_id` rows from SELECT results. However, the root fix is ensuring all inserts use `withTenant()` — which was already audited and fixed.

### Recommendation

Assign the record to the correct tenant (Option A). This is the safest approach since it preserves the data.

### Files changed

- **One database migration** — update the orphaned member's `tenant_id`

