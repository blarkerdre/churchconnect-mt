

## Fix: Tenant Switching and Tenant-Scoped Navigation

### Root cause

Two interconnected issues prevent proper tenant switching:

1. **Nav links use bare paths** — `allNavItems` in `AppLayout.jsx` defines paths like `/`, `/members`, `/events`. When a user is on `/t/wci-cardiff/dashboard`, clicking "Members" navigates to `/members` (bare), which works via the catch-all route but loses the tenant slug from the URL.

2. **TenantContext depends on URL slug** — `TenantProvider` reads `tenantSlugFromUrl` from `useParams()`. When navigating to bare paths, the slug disappears, causing `selectTenant` to fall back to the default tenant instead of maintaining the switched tenant.

Combined effect: after switching tenant and navigating to `/t/new-slug`, the first nav click takes user to a bare path, which resets context back to the default tenant.

### Fix

**1. `src/components/AppLayout.jsx`** — Make all nav links tenant-aware by prepending `/t/${tenantSlug}` to every path when a tenant slug is available:

```text
Current:  <Link to="/members">
Fixed:    <Link to={tenantSlug ? `/t/${tenantSlug}/members` : "/members"}>
```

Apply this to:
- Main nav items (line ~207-221)
- External links section
- MobileBottomNav links (if applicable)

Get `tenantSlug` from `useTenant()` context.

**2. `src/components/navigation/MobileBottomNav.jsx`** — Same fix for mobile nav links, prepend tenant slug prefix.

**3. `src/components/AppLayout.jsx` — `confirmTenantSwitch`** — After switching, also invalidate all React Query caches to prevent stale cross-tenant data:

```js
import { useQueryClient } from "@tanstack/react-query";
// ...
queryClient.clear(); // or queryClient.invalidateQueries();
```

**4. `src/App.jsx` — Route guards** — Update `AdminRoute`, `WSFRoute`, etc. to redirect to tenant-scoped paths instead of bare `/`:

```js
// Current
if (!isAdmin) return <Navigate to="/" replace />;
// Fixed — use tenantSlug from params
const { tenantSlug } = useParams();
if (!isAdmin) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
```

### Technical details

- `useTenant()` already provides `tenantSlug` — no new data fetching needed
- Nav items array stays unchanged; the prefix is applied at render time in the `<Link>` component
- React Query cache clearing on switch prevents showing data from the previous tenant

### Files changed
- `src/components/AppLayout.jsx` — prefix all nav links with tenant slug
- `src/components/navigation/MobileBottomNav.jsx` — same tenant-scoped links
- `src/App.jsx` — tenant-aware redirects in route guards

