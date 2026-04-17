

## Root Cause

The Plan tab "Save" appears successful but doesn't persist for WCI Cardiff because of a Row Level Security gap on the `tenants` table.

Current policies on `public.tenants`:
- `INSERT` — super admins ✓
- `SELECT` — super admins or tenant members ✓
- `UPDATE` — **only tenant owner/admin** (no super-admin clause)

When a super admin who is not personally listed as owner/admin of WCI Cardiff clicks Save in `TenantAdmin.jsx`, the `update()` call returns no error but matches **zero rows** (RLS silently filters it out). The mutation in `updateMutation` doesn't call `.select()`, so it can't tell that nothing was written — it shows the success toast and closes the dialog while the DB is unchanged.

This affects every tenant the super admin doesn't directly belong to as owner/admin, not just Cardiff. Cardiff is just where you noticed it (you appear to be a `member`, not `owner`, there).

## Fix

### 1. Database — add a super-admin UPDATE policy on `tenants`

New migration:
```sql
CREATE POLICY "Super admins can update any tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
```

Also add a matching DELETE policy for consistency (currently relies on edge function bypass):
```sql
CREATE POLICY "Super admins can delete any tenant"
ON public.tenants FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
```

### 2. Code — make silent no-op updates loud

In `src/pages/TenantAdmin.jsx` `updateMutation`, change the update to return rows so we detect zero-row writes:
```js
const { data, error } = await supabase
  .from("tenants")
  .update(updates)
  .eq("id", id)
  .select();
if (error) throw error;
if (!data || data.length === 0) {
  throw new Error("Update did not affect any rows. You may not have permission to edit this tenant.");
}
```

This way, if RLS ever blocks an update again, the user sees a clear error instead of a fake success.

### Files Changed
- New migration: super-admin UPDATE/DELETE policies on `tenants`
- `src/pages/TenantAdmin.jsx` — surface zero-row updates as errors (~5 lines in `updateMutation`)

