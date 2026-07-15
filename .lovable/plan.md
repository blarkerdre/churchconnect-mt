## Why "Signing out…" shows continuously

The `Auth` page never unmounts between sign-in attempts, so `didAutoSignOutRef` (a `useRef`) keeps its `true` value from the first auto-sign-out.

Sequence on the second sign-in with `blarkerdre@yahoo.com`:

1. User signs in → `user` becomes truthy again, `dataLoaded` flips to true, still no tenant membership.
2. The auto-signout `useEffect` runs, but `didAutoSignOutRef.current === true` from the previous run, so it returns early — no `signOut()` is called, no toast shown.
3. Render falls through to the "signed in, no tenant slug resolved" branch, which now shows the `animate-pulse "Signing out…"` placeholder.
4. Nothing ever clears the session, so the placeholder stays on screen indefinitely (matches the replay: "Signing out…" appears immediately after clicking Sign In and never resolves).

## Fix

Edit only `src/pages/Auth.jsx`:

1. Reset `didAutoSignOutRef.current = false` whenever `user` becomes `null` (add a small `useEffect` watching `user`), so a fresh sign-in triggers the guard again.
2. As a safety net, also trigger `signOut()` from the fallback render branch if we ever reach the "Signing out…" placeholder while `didAutoSignOutRef.current` is already true (covers any future edge case where the ref state and session state diverge).

No other files, no auth/RLS/backend changes.
