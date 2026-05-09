# Fix: page doesn't load after sign-in

## Root cause

In the recent auth speed-up, `useAuth` flips `loading` to `false` as soon as the session is known and runs `fetchUserData` (which loads `tenantMemberships`) in the background.

`Auth.jsx` redirects right after `user` becomes truthy:

```
const slug = tenantMemberships?.[0]?.tenants?.slug;
return <Navigate to={slug ? `/t/${slug}` : "/"} replace />;
```

At that moment `tenantMemberships` is still `[]`, so `slug` is `undefined` and the user is sent to `/`. Route `/` is the public `LandingPage`, so the app appears stuck / "not loading" after sign-in even though authentication succeeded.

The previous (slow) implementation hid this because it ran a second `tenant_memberships` query and waited on it before redirecting.

## Fix

Expose a separate flag from `useAuth` indicating whether the background user-data fetch has completed, and gate only the post-login redirect on it (not the rest of the app).

### `src/hooks/useAuth.jsx`
- Add new state `dataLoaded` (default `false`).
- Set `dataLoaded = false` when starting `fetchUserData`, and `dataLoaded = true` in its `finally` block.
- On sign-out, reset `dataLoaded = false` (or `true` since there's nothing to wait for — pick `true` to avoid spinner on `/auth` when logged out).
- Include `dataLoaded` in the context value.
- Keep the fast `loading=false` behavior so other pages aren't blocked.

### `src/pages/Auth.jsx`
- Pull `dataLoaded` from `useAuth`.
- When `user` is present but `dataLoaded` is still false AND there's no `tenantSlug` in the URL, render the existing `Loading...` placeholder instead of redirecting.
- Once `dataLoaded` is true, perform the existing redirect using `tenantMemberships?.[0]?.tenants?.slug`, falling back to `/` only when the user genuinely has no memberships.

## Out of scope
- TenantContext, RLS, or backend changes — issue is purely a client-side race in the redirect.
- Reverting the earlier speed-up; the fast path stays for everything except the auth-screen redirect.
