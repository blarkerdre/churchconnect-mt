

## Fix: Church Documents Storage — Restrict Upload/Delete to Admins & Leaders

### Problem

Two overly broad PERMISSIVE storage policies on `church-documents` allow **any tenant member** to upload and delete documents:

- `Tenant-scoped upload church-documents` — any member with tenant access can upload
- `Tenant-scoped delete church-documents` — any member with tenant access can delete

Because Postgres combines PERMISSIVE policies with OR, these override the narrower admin/leader policies that already exist.

### Fix (single SQL migration)

Drop the two broad policies. The existing `Admins/leaders can upload church docs` and `Admins/leaders can delete church docs` policies already correctly restrict access.

```sql
DROP POLICY IF EXISTS "Tenant-scoped upload church-documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant-scoped delete church-documents" ON storage.objects;
```

### Files changed
- Database migration only (no code changes needed)

