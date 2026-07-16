# Plan: Magic-link check-in for Bible School attendance

Let approved Bible School applicants check in without ever creating a password. If they're not signed in when they scan the QR, they enter their email and receive a one-time sign-in link that returns them straight to the check-in page.

## Changes

### 1. `src/pages/WoFBICheckin.jsx` — magic-link entry point

Replace the current "Please sign in" branch (shown when `state.error === "not_authenticated"`) with an inline email form:

- Input: email address (pre-validated).
- Button: **Email me a sign-in link**.
- Calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <absolute /wofbi/checkin/:token URL>, shouldCreateUser: true } })`.
  - `shouldCreateUser: true` covers applicants who never signed up — Supabase creates the auth user on first click.
  - `emailRedirectTo` sends them right back to the QR page; `useAuth` picks up the new session and the RPC runs automatically.
- On success: show "Check your email — we sent a sign-in link to <email>. Open it on this device."
- On error: show the Supabase error message (rate-limit friendly).

Keep the existing "already signed in" flow and error branches unchanged.

### 2. Supabase Auth config

Ensure email OTP / magic link is enabled at the project level (it's on by default for email auth, so this is a verification step, not a code change). No `configure_auth` call needed unless it's been disabled.

### 3. Nothing else changes

- `wofbi_checkin` RPC is unchanged — the email-fallback + `user_id` backfill from the earlier migration already handles the case where the member row was created before the auth user existed.
- No new tables, no trigger changes, no edge function.
- Public registration and admin approval flows are untouched.

## Technical notes

- `signInWithOtp` with `shouldCreateUser: true` is the standard Supabase magic-link flow. Auth emails route through the existing Lovable auth email pipeline (`auth-email-hook`), so branding/templates carry over automatically.
- The redirect URL must be absolute: `` `${window.location.origin}/wofbi/checkin/${token}` ``.
- Applicants who typo their email at the check-in page (different from the one on their application) will end up with a member row that can't be matched. The RPC's email fallback matches on the applicant's application email, so we should tell them on the form: "Use the same email you registered with."
- Rate limit: Supabase caps auth emails per hour per project. If tenants run big Bible School sessions, `rate_limit_email_sent` may need raising later — flag but don't change now.

## Out of scope

- No auto-provisioning on approval.
- No SMS OTP.
- No change to the standard `/auth` sign-in page for members who *do* have passwords.
