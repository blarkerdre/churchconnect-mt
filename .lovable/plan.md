# Fix app-wide flicker and slowness

## Root cause
The `AuthProvider` + `TenantProvider` pair is stuck in a re-render/refetch loop, and the loop runs in several parallel `AuthProvider` instances at once.

1. `src/hooks/useAuth.jsx` — `refetchMemberForTenant` is defined as a plain function inside `AuthProvider`, so it gets a new identity on every render. The `AuthContext.Provider value={{...}}` object is also rebuilt inline every render.
2. `src/contexts/TenantContext.jsx` — has:
   ```js
   useEffect(() => {
     if (tenantId && refetchMemberForTenant) refetchMemberForTenant(tenantId);
   }, [tenantId, refetchMemberForTenant]);
   ```
   Because `refetchMemberForTenant` is unstable, this effect fires on every render → calls `setMyMember` in `useAuth` → `AuthProvider` re-renders → new `refetchMemberForTenant` → effect fires again. Infinite loop.
3. `src/App.jsx` — mounts `<AuthProvider>` multiple times (around `AppRoutes` authenticated tree, `/auth`, `/accept-invite`, `/auth/exam-callback`, `/reset-password`, `/t/:slug/auth`, `/t/:slug/bible-school-register`, `/t/:slug/reset-password`, and around `MFASetupDialog` at the router root). Each instance runs its own `supabase.auth.onAuthStateChange` and its own loop → 2–3× duplicated fetches and re-renders on every auth event.

## Changes

### 1. `src/hooks/useAuth.jsx` — memoize the unstable bits (surgical fix)
- Wrap `refetchMemberForTenant` in `useCallback` keyed on `user?.id`. This alone breaks the render loop.
- Wrap the context `value` in `useMemo` keyed on its actual dependencies (`user, profile, roles, loading, dataLoaded, leaderUnits, leaderCentres, myMember, tenantMemberships`).
- Also memoize `refreshUser` the same way so it doesn't churn consumers.

No behaviour change; only identity stability.

### 2. `src/App.jsx` — mount `AuthProvider` exactly once
Move a single `<AuthProvider>` to wrap the whole `<Router>` subtree (inside `QueryClientProvider`). Remove every nested `<AuthProvider>` from:
- The wrapper around `MFASetupDialog`
- `AppRoutes` routes for `/auth`, `/accept-invite`, `/auth/exam-callback`, `/reset-password`, `/t/:slug/auth`, `/t/:slug/bible-school-register`, `/t/:slug/reset-password`, and the `/*` authenticated block

One provider = one auth listener = one fetch per event. Public pages that already used `useAuth` keep working because the single provider is now above them.

### 3. Verification
1. Flush HMR and reload the preview.
2. Open React DevTools Profiler on the Dashboard; confirm the app is idle after mount (no continuous render commits every ~100ms).
3. Watch Network tab — should see one burst of `profiles / user_roles / unit_leader_assignments / members / tenant_memberships` on load, and none afterwards while idle.
4. Navigate around; UI should no longer flash.

## Out of scope
- No changes to `useAuth`'s fetch logic, token-refresh handling, or the underlying queries.
- No changes to `TenantContext` logic (the effect there becomes correct once its dependency is stable). If we still see extra runs after step 1, we'll narrow that effect's deps in a follow-up.
- No changes to individual pages or their query hooks.
