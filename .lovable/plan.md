

## Fix: `/auth` Route Redirects to WCI Cardiff

### Root cause

Line 194 in `src/App.jsx`:
```jsx
<Route path="/auth" element={<DefaultTenantRedirect to="auth" />} />
```
This always redirects `/auth` → `/t/wci-cardiff/auth`. The landing page "Sign In" buttons link to `/auth`, so every user ends up on WCI Cardiff's auth page regardless of intent.

### Fix

**`src/App.jsx`** — Replace the redirect with a tenant-agnostic Auth page:

```jsx
<Route path="/auth" element={<AuthProvider><Auth /></AuthProvider>} />
```

This renders the Auth component directly at `/auth` without a tenant slug. The Auth component already handles this case — it shows "Church Connect" branding (no tenant-specific branding) and after login redirects the user to their actual tenant based on their membership query.

### Files changed
- `src/App.jsx` — change `/auth` route from `DefaultTenantRedirect` to render `Auth` directly

