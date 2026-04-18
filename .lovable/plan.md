

## Root cause

In `NotificationBell.jsx` (line 143), join-request notifications navigate to `/t/:tenantSlug/dashboard`. But `AppPages` in `src/App.jsx` mounts the dashboard at `/`, not `/dashboard`. There is no `/dashboard` route, so it falls through to the catch-all `<Route path="*" element={<Navigate to="/" replace />} />`, which lands on the public **LandingPage** (mounted at `/` outside the auth wrapper).

## Fix

In `src/components/notifications/NotificationBell.jsx`, change the leader-side join-request route from `/dashboard` to `/` (which is the actual authenticated dashboard inside `AppPages`).

```js
// Line 143 — before:
route = "/dashboard";
// after:
route = "/";
```

The tenant prefix logic (`tenantSlug ? '/t/${tenantSlug}${route}' : route`) already produces `/t/:slug/` correctly when `route === "/"`.

## Why not add a `/dashboard` route instead?

Could also alias `/dashboard → Dashboard` in `AppPages`, but every other piece of the app (sidebar, redirects, login) already treats `/` as the dashboard. Changing the notification route is the smaller, consistent fix.

## Files
**Edit**
- `src/components/notifications/NotificationBell.jsx` — one-line change on line 143

## Out of scope
- Adding `/dashboard` as an alias route
- Auditing other places that might use `/dashboard` (none found in `App.jsx`)

