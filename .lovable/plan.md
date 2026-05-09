## Problem

The Growth Milestones tile shows blank/zero values (Water Baptism, Holy Spirit Baptism, BFC, Home Cell). Root cause: the previous migration calls `public.user_has_tenant_access(auth.uid(), _tenant_id)` with two arguments, but in this database that function only accepts a single `_tenant_id` argument. The RPC throws `function user_has_tenant_access(uuid, uuid) does not exist`, so the dashboard query fails silently and `dashStats` stays empty — every milestone resolves to `0 / activeCount (0%)`.

## Fix

Recreate `public.get_dashboard_stats(_tenant_id uuid)` with the correct single-argument access check, keeping the Active-only milestone filters from the prior fix.

### Technical detail

```sql
IF NOT public.user_has_tenant_access(_tenant_id) THEN
  RAISE EXCEPTION 'access denied for tenant %', _tenant_id;
END IF;
```

Everything else (Active-only `FILTER` clauses for water_baptism, hs_baptism, bfc_completed, winners_satellite) stays as-is. No frontend changes.

## Validation

After migration, calling `get_dashboard_stats` for wci-cardiff returns non-zero milestone counts, and the Dashboard renders proper percentages against the Active denominator.
