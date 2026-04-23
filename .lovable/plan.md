

## Fix duplicate-key error when creating a Course

### Root cause

`exam_titles` has a **global** `UNIQUE (name)` constraint (`exam_titles_name_key`). In a multi-tenant app this means: as soon as one church creates "Foundation Class", **no other tenant** can ever create a course with that name — Postgres rejects it with `duplicate key value violates unique constraint "exam_titles_name_key"`.

That violates our multi-tenancy isolation rule (each tenant should be free to use whatever course names it wants).

### The fix — one migration

Replace the global unique constraint with a **per-tenant** unique index:

```sql
-- Drop the global unique constraint
ALTER TABLE public.exam_titles DROP CONSTRAINT exam_titles_name_key;

-- Replace it with a tenant-scoped unique index (case-insensitive
-- so "Foundation Class" and "foundation class" are still treated as duplicates
-- WITHIN the same tenant, but never across tenants)
CREATE UNIQUE INDEX exam_titles_tenant_name_unique
  ON public.exam_titles (tenant_id, lower(name));
```

That's the only schema change needed. No code changes — `ExamManagement.jsx` already inserts with `tenant_id` via `withTenant(...)`.

### What changes for users

- WCI Croydon (and every other tenant) can now create a course with any name, even if another church already uses that name.
- Within a single church, you still can't create two courses with the same name (the per-tenant index enforces that, case-insensitively).
- Existing courses are unaffected — no data is moved or deleted.

### Acceptance checks

1. As a WCI Croydon admin, create a course named "Foundation Class" (or any name already used by another tenant) — succeeds.
2. As the same Croydon admin, try to create a second "Foundation Class" in Croydon — fails with the existing duplicate error (correct behaviour, scoped to the tenant).
3. Renaming an existing course to a name used by another tenant — succeeds.
4. Renaming an existing course to a name already used in your own tenant — fails (correct).
5. The four pre-existing course rows still load on the Course Management page.

### Files touched

- **New migration**: drops `exam_titles_name_key`, creates `exam_titles_tenant_name_unique`.
- No frontend or edge-function changes.

