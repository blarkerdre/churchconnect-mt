

## Fix: Replace Global Unique Constraint on `church_units.name` with Tenant-Scoped

### Problem

`church_units` has a unique constraint `church_units_name_key` on `(name)` alone. In a multi-tenant system, different tenants need to use the same unit names (e.g. "Choir", "Ushering"). The constraint must be scoped to `(tenant_id, name)`.

### Fix

One database migration:

```sql
ALTER TABLE public.church_units DROP CONSTRAINT IF EXISTS church_units_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS church_units_tenant_id_name_key ON public.church_units (tenant_id, name);
```

### Files changed

- **One database migration** — replace global unique constraint with tenant-scoped unique index

