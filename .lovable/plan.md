

## Fix: Restrict Anonymous Access to Tenants Table

### Problem

The `tenants` table has an RLS policy `"Anon can view tenant by slug"` with `USING (true)`, exposing all tenant rows -- including settings, plan tiers, feature flags, and internal configuration -- to unauthenticated users.

### Who Needs Anonymous Access

Two frontend pages query `tenants` as `anon`:

1. **`Auth.jsx`** -- looks up `id, name, slug, logo_url, settings` by slug for login page branding
2. **`PublicRegistration.jsx`** -- looks up `id` by slug to resolve `tenant_id`

Both always filter by slug. They only need non-sensitive fields.

### Solution

1. **Drop** the `"Anon can view tenant by slug"` policy
2. **Create a security-definer RPC** `get_tenant_by_slug(slug text)` returning only safe fields: `id`, `name`, `slug`, `logo_url`, and a filtered subset of `settings` (only branding keys like `favicon_url`, `og_image_url`, `primary_color`, `sender_name` -- not feature flags, plan details, or internal config)
3. **Update `Auth.jsx`** to call `supabase.rpc("get_tenant_by_slug", { _slug: tenantSlug })` instead of direct table query
4. **Update `PublicRegistration.jsx`** to call the same RPC (it only needs `id`)

### Technical Details

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "Anon can view tenant by slug" ON public.tenants;

CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug text)
RETURNS TABLE (id uuid, name text, slug text, logo_url text, settings jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id, t.name, t.slug, t.logo_url,
    jsonb_build_object(
      'favicon_url', t.settings->'favicon_url',
      'og_image_url', t.settings->'og_image_url',
      'primary_color', t.settings->'primary_color',
      'sender_name', t.settings->'sender_name'
    ) AS settings
  FROM public.tenants t
  WHERE t.slug = _slug AND t.is_archived IS NOT TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;
```

**`Auth.jsx`:** Replace `.from("tenants").select(...)` with `.rpc("get_tenant_by_slug", { _slug: tenantSlug })`

**`PublicRegistration.jsx`:** Replace `.from("tenants").select("id").eq("slug", tenantSlug)` with `.rpc("get_tenant_by_slug", { _slug: tenantSlug })`

### Files Changed

- **One database migration** -- drop policy, create safe RPC
- **`src/pages/Auth.jsx`** -- use RPC
- **`src/pages/PublicRegistration.jsx`** -- use RPC

