

## Fix: Verification Email Link Redirects to Wrong Tenant

### Root cause

In `src/hooks/useAuth.jsx` line 81, the `emailRedirectTo` is set to `window.location.origin` (e.g. `https://churchconnect-mt.lovable.app`). This means after email verification, the user lands on the bare root URL with no tenant context, which then defaults or redirects incorrectly.

The `tenantSlug` parameter is already passed into the `signUp` function but is only used for `user_metadata` — not for the redirect URL.

### Fix

**`src/hooks/useAuth.jsx`** — Update `emailRedirectTo` to include the tenant slug:

```js
emailRedirectTo: tenantSlug
  ? `${window.location.origin}/t/${tenantSlug}`
  : window.location.origin,
```

This ensures that when a user clicks the verification link in their email, they land on `/t/wci-cardiff` (or whichever tenant they signed up under) instead of the bare root.

### Files changed
- `src/hooks/useAuth.jsx` — tenant-scope the `emailRedirectTo` in `signUp`

