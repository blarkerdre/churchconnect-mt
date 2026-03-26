

## Fix: Remove Anonymous Access to Church Units Table

### Problem

The `church_units` table has `"Public can view church units"` with `USING (true)` for `anon`, exposing all unit names and tenant IDs to unauthenticated users.

### Who Needs Anon Access

Only `PublicRegistration.jsx` queries church units for the registration form. It needs unit names for a multi-select picker.

### Solution

1. **Drop the anon policy** on `church_units`
2. **Create a safe RPC** `get_active_church_unit_names(_tenant_slug text)` that returns only `id` and `name`, scoped to the tenant resolved by slug
3. **Update `PublicRegistration.jsx`** to call the RPC instead of using `useChurchUnits()`

### Technical Details

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "Public can view church units" ON public.church_units;

CREATE OR REPLACE FUNCTION public.get_active_church_unit_names(_tenant_slug text DEFAULT NULL)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cu.id, cu.name
  FROM public.church_units cu
  WHERE cu.is_active = true
    AND (_tenant_slug IS NULL OR cu.tenant_id = (
      SELECT t.id FROM public.tenants t
      WHERE t.slug = _tenant_slug AND t.is_archived IS NOT TRUE
      LIMIT 1
    ))
  ORDER BY cu.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_church_unit_names(text) TO anon, authenticated;
```

**`PublicRegistration.jsx` change:** Replace `useChurchUnits()` with a local query calling `supabase.rpc("get_active_church_unit_names", { _tenant_slug: tenantSlug })`.

### Files Changed

- **One database migration** -- drop anon policy, create safe RPC
- **`src/pages/PublicRegistration.jsx`** -- use RPC for church unit names on public form

