## Problem

The "New Task" button on Unit Tasks is disabled for admins because `allUnits` is empty.

Root cause: `src/pages/UnitTasks.jsx` calls the RPC with the wrong parameter name:

```js
supabase.rpc("get_active_church_unit_names", { _tenant_id: tenantId })
```

The actual function signature is `get_active_church_unit_names(_tenant_slug text)`. The mismatched parameter makes the RPC error out; the catch returns `[]`, so `allUnits` stays empty and the button stays disabled.

## Fix

In `src/pages/UnitTasks.jsx`, replace the RPC call with a direct, tenant‑scoped query against `church_units` (consistent with how units are listed elsewhere in the app and avoids any slug/uuid coupling):

```js
const { data, error } = await supabase
  .from("church_units")
  .select("name")
  .eq("tenant_id", tenantId)
  .eq("is_active", true)
  .order("name");
if (error) return [];
return (data || []).map((r) => r.name).filter(Boolean);
```

Leave the non-admin branch (`return leaderUnits || []`) as-is.

## Out of scope

- No RLS / migration changes — the previous migration already fixed the admin insert permission.
- No changes to the form, member filtering, or report dialog.
