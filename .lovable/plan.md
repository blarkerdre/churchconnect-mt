
## Fix notification View still redirecting to /auth

### Root cause
This is no longer just a `tenantSlug` issue.

From the current code and network snapshot:

1. `NotificationBell.jsx` fetches notifications by `user_id` only, not by the active `tenant_id`.
2. Your current tenant is `demo-test`, but the loaded notification belongs to a different church:
   - active tenant: `d8bbbdae...` / slug `demo-test`
   - notification tenant: `95e53cc3...`
3. When you click **View**, the app builds a URL inside the current tenant, but the target record belongs to another tenant. That destination is then blocked by tenant-aware access checks and you end up on an auth/redirect path.
4. There is also a route bug: announcement notifications map to `/dashboard`, but this app’s actual dashboard route is `/`.

### What to change

#### 1. Scope notifications to the active tenant
Update `src/components/notifications/NotificationBell.jsx` so the query only loads notifications for:
- `user_id = current user`
- `tenant_id = current tenant`

Also update:
- realtime subscription filter
- mark-as-read
- mark-all-read
- delete mutation

Each should include `tenant_id` so the bell only works within the active church context.

#### 2. Fix the announcement route
Change:
- `announcement: "/dashboard"`
to:
- `announcement: "/"`

That matches the actual router in `src/App.jsx`.

#### 3. Add a tenant guard before navigation
In `handleNavigate`, if `selected.tenant_id !== tenantId`, do not navigate.
Instead, show a clear message or disable the button for cross-tenant notifications.

This prevents future wrong-tenant redirects even if old notifications still exist.

#### 4. Optional cleanup for old mixed notifications
If users already have legacy cross-tenant notifications in the table, the UI should either:
- hide them automatically because of tenant filtering, or
- show them without a View button if they somehow still appear.

### Files to update
- `src/components/notifications/NotificationBell.jsx`

### Expected result
After this fix:
- each church only sees its own notifications
- announcement notifications open the correct dashboard route
- View will no longer send users to `/auth` because of wrong-tenant notification records

### Technical notes
- Current bug is caused by missing tenant scoping, not hosting or SPA routing.
- The network snapshot confirms a mismatch: notification tenant_id differs from the active tenant.
- This aligns with the project’s tenant-isolation rule: all reads/writes must include `tenant_id`.
