

## Fix: Add Missing Unique Constraint on `app_settings`

### Problem

The upsert in `ExternalLinksSection.jsx` uses `onConflict: "key,tenant_id"` but the `app_settings` table has no unique constraint on `(key, tenant_id)`, so Postgres rejects it.

### Fix

One database migration:

```sql
ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_key_tenant_id_key UNIQUE (key, tenant_id);
```

### Files changed

- **One database migration** — add the unique constraint

