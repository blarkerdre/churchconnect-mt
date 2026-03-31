

## Fix: Signup Directed to Demo Church Instead of Correct Tenant

### Root cause

There is a mismatch between two "default tenant" references:

- `DEFAULT_TENANT_ID` in `TenantContext.jsx` and `handle_new_user` trigger = `d8bbbdae-...` = **Demo Church (TEST)**
- `DefaultTenantRedirect` in `App.jsx` hardcodes slug `"wci-cardiff"` = `95e53cc3-...` = **Winners Chapel International, Cardiff**

When a user signs up, the `defaultTenantSlug` query in Auth.jsx resolves Demo Church's slug (`demo-test`), not WCI Cardiff. And the `handle_new_user` trigger's fallback also creates memberships under Demo Church.

Additionally, `AuthRoutes` still has a bare `/auth` route (line 136) that renders `<Auth />` without tenant context — a potential leak path.

### Fix

**1. `src/contexts/TenantContext.jsx`** — Change `DEFAULT_TENANT_ID` to WCI Cardiff's ID:
```js
const DEFAULT_TENANT_ID = "95e53cc3-4569-4dd3-a4ad-3489593dce81";
```

**2. Migration** — Update the `handle_new_user` trigger to fall back to WCI Cardiff instead of Demo Church:
```sql
-- Change fallback from Demo Church to WCI Cardiff
_tenant_id := '95e53cc3-4569-4dd3-a4ad-3489593dce81'::uuid;
```

Also backfill any users currently stuck on Demo Church who should be on WCI Cardiff (same pattern as previous migration).

**3. `src/App.jsx`** — Remove the bare `/auth` route from `AuthRoutes` (line 136) since it's unreachable but could cause confusion if hit.

**4. `supabase/functions/public-register/index.ts`** — Update the `DEFAULT_TENANT_ID` constant to match WCI Cardiff's ID.

### Files changed
- `src/contexts/TenantContext.jsx` — update DEFAULT_TENANT_ID to WCI Cardiff
- `src/App.jsx` — remove stale bare `/auth` route from AuthRoutes
- `supabase/functions/public-register/index.ts` — update DEFAULT_TENANT_ID
- 1 new migration — update `handle_new_user` fallback + backfill mismatched users

