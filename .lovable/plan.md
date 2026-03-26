

## Fix: Remove Public Anonymous Access to WSF Centres

### Problem

The `wsf_centres` table has an RLS policy `"Public can view wsf centres"` with `USING (true)` for the `anon` role. This exposes all centre data — including home addresses, postcodes, and `host_member_id` — to unauthenticated users.

### Who Needs Access

- **Authenticated users** (admins, leaders, members): Already covered by existing tenant-scoped policies
- **Public registration page** (`PublicRegistration.jsx`): Queries `wsf_centres` to show a centre picker — but this runs as `anon` and currently relies on the public policy. It only needs `id` and `name`.

### Solution

1. **Drop** the `"Public can view wsf centres"` anonymous SELECT policy
2. **Create a security-definer function** `get_active_wsf_centre_names()` that returns only `id` and `name` for active centres — no addresses, postcodes, or host info. This is callable by `anon`.
3. **Update `PublicRegistration.jsx`** to call `supabase.rpc("get_active_wsf_centre_names")` instead of querying the table directly.

### Technical Details

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "Public can view wsf centres" ON public.wsf_centres;

CREATE FUNCTION public.get_active_wsf_centre_names()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, name FROM public.wsf_centres
  WHERE is_active = true ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_wsf_centre_names() TO anon, authenticated;
```

**`PublicRegistration.jsx` change (line ~55):**
Replace `supabase.from("wsf_centres").select("*")...` with `supabase.rpc("get_active_wsf_centre_names")`.

### Files Changed

- **One database migration** — drop policy, create safe RPC
- **`src/pages/PublicRegistration.jsx`** — use RPC instead of direct table query

