

## Fix: View Button Navigating to /auth

### Root Cause

`NotificationBell.jsx` line 43 destructures `tenantSlug` from `useTenantQuery()`, but that hook does not return `tenantSlug`. It's always `undefined`, so `handleNavigate` builds routes like `/events` instead of `/t/demo-test/events`. The router sees no tenant context and redirects to `/auth`.

### Fix

Import `useTenant` from `TenantContext` directly (which does expose `tenantSlug`) instead of trying to get it from `useTenantQuery`.

#### `src/components/notifications/NotificationBell.jsx`
- Add `import { useTenant } from "@/contexts/TenantContext";`
- Get `tenantSlug` from `useTenant()` instead of `useTenantQuery()`
- Keep `useTenantQuery()` for `tenantId` (used in the query key)

### Files changed
- `src/components/notifications/NotificationBell.jsx` — fix `tenantSlug` source

