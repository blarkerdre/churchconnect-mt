# Why the email appears on /auth

Supabase persists the auth session in the browser's local storage. On page load, `useAuth.jsx` calls `supabase.auth.getSession()` and restores the previous session — so `blarkerdre@yahoo.com` is "signed on" because that browser previously logged in as that user and never signed out.

Normally `Auth.jsx` redirects a signed-in user away (`<Navigate to={...} />`), but on the root `/auth` (no `tenantSlug`), it redirects using `tenantMemberships[0]?.tenants?.slug`. If that user has no tenant memberships loaded, they fall through to `/`, which may bounce back to `/auth`, leaving the email visible in whatever UI reads the session.

# Plan: show a "Continue as / Sign out" prompt on /auth

When a session is restored on `/auth` and we can't cleanly redirect (no tenant slug resolved), stop rendering the login form and instead show a small card:

- "You're signed in as **blarkerdre@yahoo.com**"
- Primary button: **Continue** → navigate to `/` (or the resolved tenant route if available)
- Secondary button: **Sign out and use another account** → `signOut()` then stay on `/auth` to reveal the login form

## Changes

**`src/pages/Auth.jsx`**
- Import `signOut` from `useAuth`.
- Before the existing `if (user)` redirect block, if `user` exists AND no `tenantSlug` in URL AND no `tenantMemberships[0]?.tenants?.slug`, render the "Continue as / Sign out" card instead of `<Navigate />`.
- Keep existing redirect behavior when a tenant slug is available (URL or membership).
- "Sign out" calls `signOut()` — component re-renders with `user = null` and the normal login form shows.

## Out of scope

- No changes to `useAuth`, session storage strategy, or tenant resolution logic.
- No auto sign-out on `/auth` (would log out users who intentionally revisit the page).
