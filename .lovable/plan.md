

## Plan: Auto-redirect to Tenant URL After Default Login

### Problem
When users sign in via `/auth` (no tenant slug), they redirect to `/` which works but lacks tenant-prefixed URL, breaking consistent branding and bookmarkable URLs.

### Solution
In `Auth.jsx`, when `user` is detected and there's no `tenantSlug` in the URL, query the user's `tenant_memberships` to find their tenant slug, then redirect to `/t/{slug}` instead of `/`.

### Changes

**`src/pages/Auth.jsx`**
- Add a query for the user's tenant membership when `user` is set and no `tenantSlug` is present
- Query `tenant_memberships` joined with `tenants` to get the slug
- Redirect to `/t/{slug}` if a membership is found, fall back to `/` if none exists
- Show loading state while the membership query resolves

The redirect block (lines 68-71) changes from:
```js
if (user) {
  const redirectTo = tenantSlug ? `/t/${tenantSlug}` : "/";
  return <Navigate to={redirectTo} replace />;
}
```
To: query `tenant_memberships` for the logged-in user, pick the first (or default) membership's tenant slug, and redirect to `/t/{slug}`. While the query loads, show the existing loading spinner. If the user has no memberships, fall back to `/`.

### No other files need changes
The rest of the routing (TenantProvider, AppPages, navigation) already handles tenant-prefixed URLs correctly.

