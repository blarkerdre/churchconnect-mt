

## Fix: Verification Link Returns 404 on Custom Domain

### Problem

When a user clicks a verification/password-reset link from an auth email, they land on `app.churchmanagementsuite.org` but get a 404. This happens because:

1. **Supabase Auth's Site URL** is likely still set to the default (`churchconnect-mt.lovable.app`) rather than the custom domain `app.churchmanagementsuite.org`
2. When Auth generates confirmation URLs, it redirects the user to the Site URL with tokens in the URL fragment (`#access_token=...&type=recovery`)
3. The SPA at `app.churchmanagementsuite.org` receives this, but if the redirect URL config doesn't include the custom domain, Supabase Auth may reject or misroute the callback

### Root Cause

Supabase Auth controls where verification links redirect. The **Site URL** and **Redirect URLs** must match the domain where the app is hosted. Currently the custom domain is `app.churchmanagementsuite.org`, but Auth is likely configured with the `.lovable.app` URL.

### Fix

#### 1. Update Supabase Auth URL configuration

This needs to be done via Cloud settings:
- **Site URL** → `https://app.churchmanagementsuite.org`
- **Redirect URLs** → add `https://app.churchmanagementsuite.org/**`

This ensures verification links redirect users to the correct domain where the SPA is running.

#### 2. Update auth-email-hook template URLs

In `supabase/functions/auth-email-hook/index.ts`, update the sample/preview URLs:
- `SAMPLE_PROJECT_URL` → `https://app.churchmanagementsuite.org`
- `siteUrl` in `templateProps` → `https://app.churchmanagementsuite.org`

#### 3. Verify SPA handles auth callback

The app already has a `/reset-password` route and `useAuth` handles `onAuthStateChange`. The SPA router uses a catch-all `/*` route, so hash-based auth tokens should work. No routing changes needed.

### Technical details

```text
Current flow (broken):
1. User clicks "Reset Password" link in email
2. Link points to Supabase Auth server with redirect_to param
3. Supabase Auth redirects to Site URL (churchconnect-mt.lovable.app)
4. But browser is at app.churchmanagementsuite.org → 404

Fixed flow:
1. User clicks "Reset Password" link in email
2. Supabase Auth redirects to app.churchmanagementsuite.org
3. SPA loads, picks up tokens from URL hash
4. Auth state updates, user can reset password
```

### Files to change

- **Auth URL config** — update Site URL + Redirect URLs via Cloud settings
- **`supabase/functions/auth-email-hook/index.ts`** — update `SAMPLE_PROJECT_URL` and `siteUrl` references

