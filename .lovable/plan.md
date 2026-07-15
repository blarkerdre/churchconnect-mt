## Goal

Prevent auth accounts (like `blarkerdre@yahoo.com`) that have zero rows in `tenant_memberships` from remaining signed in. Credentials still authenticate against `auth.users`, but the app will immediately sign them out and show a clear message.

## Change

Edit `src/pages/Auth.jsx` only. No DB, RLS, or `useAuth` changes.

In the existing "signed in but no tenant resolved" branch (after `dataLoaded` is true and `tenantMemberships[0]?.tenants?.slug` is missing):

1. Instead of rendering the "Continue / Sign out" card, call `signOut()` once via a `useEffect` guarded by a local `didAutoSignOut` ref/state so it fires exactly once.
2. Show a toast: "No church access — this account isn't linked to any church. Please contact your church admin."
3. While signing out, render the existing "Loading…" placeholder. After `signOut()` resolves, `user` becomes `null` and the normal login form renders automatically.
4. Preserve current behavior when `tenantSlug` is in the URL or a membership slug resolves — those still redirect as before.
5. Keep the `claimToken` branch intact (claim runs first; only auto-sign-out if no claim is pending).

## Out of scope

- Deleting the auth user (`blarkerdre@yahoo.com` will still exist; it just can't stay signed in).
- Any RLS, policy, role, or RPC change.
- Any change to `useAuth`, session persistence, or Supabase config.
- Signup flow changes — signup already requires a tenant slug.

## Technical notes

- Uses existing `signOut` from `useAuth` and existing `useToast`.
- Gate the effect on `user && dataLoaded && !tenantSlug && !tenantMemberships?.[0]?.tenants?.slug && !claimToken`.
- Use a `useRef(false)` flag to avoid a sign-out loop if `dataLoaded` flips during the async call.
