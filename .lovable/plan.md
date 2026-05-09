# Speed up the Auth page loading

## What's actually slow

Two "Loading..." gates show on `/auth`:

1. **`useAuth().loading`** — stays `true` until `fetchUserData()` finishes. That function runs **5 parallel Supabase queries** (`profiles`, `user_roles`, `unit_leader_assignments`, `members` with a join to `wsf_centres`, `tenant_memberships`) and then **a 6th sequential query** to `wsf_centres` if a member row exists. Every page in the app — including `/auth` itself — is blocked behind this, even though `/auth` doesn't need any of that data when no user is signed in.

2. **`membershipLoading`** in `src/pages/Auth.jsx` (lines 88–101) — after login, a *second* query to `tenant_memberships` runs just to find the slug for redirect, even though `useAuth` already fetched `tenant_memberships` for the same user a moment earlier. So the user sees "Loading..." twice in a row after sign-in.

There is also a small, non-blocking cost from `import("@/pages/Dashboard")` prefetch on mount — fine to keep.

## Plan

### 1. Don't block `/auth` on `fetchUserData`
In `src/hooks/useAuth.jsx`:
- When there is no session, `setLoading(false)` runs already — good.
- When there IS a session, set `loading = false` as soon as we know the user, and let the profile/roles/units/etc. fill in afterwards (they each have their own state). Components that truly need roles can read `roles`/`isAdmin` directly; they're already arrays that update reactively.
- Concretely: in both the `onAuthStateChange` and `getSession()` branches, call `setLoading(false)` immediately after `setUser(...)`, then kick off `fetchUserData` in the background. Remove the `finally { setLoading(false) }` from `fetchUserData` (or guard it so it only flips loading on first run).

This alone removes the initial "Loading..." flash on `/auth` and any other page on cold load.

### 2. Reuse `tenantMemberships` for the post-login redirect
In `src/pages/Auth.jsx`:
- Delete the `useQuery(["auth-redirect-membership", ...])` block (lines 88–101) and the `membershipLoading` gate (lines 116–122).
- Pull `tenantMemberships` from `useAuth()`. Resolve the slug from the first membership by joining locally — but since `tenant_memberships` in `useAuth` only selects `tenant_id, role`, extend that select to also pull `tenants(slug)`:
  ```js
  supabase.from("tenant_memberships").select("tenant_id, role, tenants(slug)").eq("user_id", userId)
  ```
- In Auth.jsx redirect block, use `tenantMemberships[0]?.tenants?.slug` for the redirect target. If memberships haven't arrived yet, render nothing (or the small spinner) for at most one render — but no extra round trip.

### 3. Tighten the member→centres query
In `fetchUserData`, fold the leader-centres lookup into the parallel batch by switching to a single query that uses `leader_id` once `memberRes.data?.id` is known — or accept the second hop, since it now runs in the background and no longer blocks UI after step 1. No code change required if step 1 lands; leave as a follow-up if perf still feels off.

## Files touched

- `src/hooks/useAuth.jsx` — non-blocking loading, extend `tenant_memberships` select with `tenants(slug)`.
- `src/pages/Auth.jsx` — remove the duplicate membership query and its loading gate; read slug from `useAuth().tenantMemberships`.

## Out of scope

- RLS policy tuning, indexes, or Cloud instance sizing — backend reports healthy; the wins above are pure frontend.
- Changes to other pages that consume `useAuth().loading`. They will simply render sooner; if any of them assume `roles` is fully populated when `loading` flips false, we'll handle those case-by-case in a follow-up.
