## Problem

You're signed in and sitting on `/auth`, but the page is stuck on "Loading…".

The recent fix added a gate: when `user` exists but `dataLoaded` is still `false`, render "Loading…" instead of redirecting. `dataLoaded` only flips `true` inside `fetchUserData`'s `finally` block, which depends on five parallel Supabase queries resolving. In the Lovable Preview, Supabase REST calls have been intermittently failing/hanging ("Failed to fetch" earlier in this thread). When `Promise.all` never resolves and never rejects, the `finally` never runs, so `dataLoaded` stays `false` forever and `/auth` never redirects.

## Fix (frontend only, no backend changes)

### `src/hooks/useAuth.jsx`
1. Wrap each query in `fetchUserData` so a single failure can't strand the whole batch — replace `Promise.all` with `Promise.allSettled`, and read `.value` per result. This guarantees the `finally` runs and `dataLoaded` becomes `true`.
2. Add a hard safety net: when starting `fetchUserData`, also schedule a `setTimeout(..., 5000)` that calls `setDataLoaded(true)` if it's still `false` (covers true network hangs where the fetch never resolves at all). Clear the timer in `finally`.
3. Special-case the membership query: if it fails, `tenantMemberships` stays `[]` (already the default) — that's fine, redirect logic already handles "no slug" by sending the user to `/`.

### `src/pages/Auth.jsx`
1. Keep the existing `dataLoaded` gate, but cap it: track a local `waited` flag with a `setTimeout` of ~4s after `user` becomes truthy. Once either `dataLoaded` is true OR `waited` is true, perform the redirect using whatever `tenantMemberships` we have (falling back to `/` if empty).
2. While waiting, keep the current "Loading…" placeholder, but after the timeout the user is moved off `/auth` instead of being stranded.

## Out of scope
- TenantContext, RLS, Supabase queries themselves.
- The underlying preview "Failed to fetch" — that's a Lovable Preview environment issue; this plan only makes the UI resilient to it.

## Verification
- On the published URL, signing in should still redirect to `/t/<slug>` immediately (fast path: `dataLoaded` flips true before the 4s timer).
- In preview, even if Supabase queries hang, `/auth` will redirect within ~4s instead of looping on "Loading…".
