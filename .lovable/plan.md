## Problem

`supabase/functions/register-tenant/index.ts` is a public, unauthenticated edge function (used by `/onboard` for self-serve church signup). Two real risks:

1. **Privilege escalation** — it inserts `user_roles { role: 'super_admin', tenant_id }`. Combined with `is_admin()`'s check `role IN ('admin','super_admin')` (no tenant filter for `super_admin`), this gives every newly-registered tenant owner platform-wide super-admin powers.
2. **Abuse / spam tenant creation** — anyone can spin up unlimited tenants + auth users with no throttling or bot protection.

## Plan

Keep the endpoint public (self-serve onboarding must work) but harden it.

### 1. Stop granting platform super_admin
In `register-tenant/index.ts` step 5, change the `user_roles` insert from `role: "super_admin"` to `role: "admin"` (tenant-scoped). The `tenant_memberships` row already gives them `owner`, and `is_admin(user, tenant)` recognises both. They keep full control of *their own* tenant, but no cross-tenant powers.

### 2. Add a one-time migration to demote any existing self-registered super_admins
Migration: for every `user_roles` row where `role='super_admin' AND tenant_id IS NOT NULL`, downgrade to `'admin'`. (True platform super-admins have `tenant_id IS NULL` and are unaffected.)

### 3. Add abuse protection on the public endpoint
- **CAPTCHA**: require a Cloudflare Turnstile token in the request body (`captcha_token`). Verify server-side against Turnstile's siteverify endpoint using a `TURNSTILE_SECRET_KEY` secret. Reject with 400 if missing/invalid.
- **Rate limit**: simple table `public_signup_attempts (ip text, created_at timestamptz default now())`; reject if >3 attempts from same IP in last hour. IP read from `cf-connecting-ip` / `x-forwarded-for`.
- **Input hardening**: enforce `slug` length 3–40, `church_name` length 2–120, `admin_password` ≥ 10 chars, `admin_email` regex, reject reserved slugs (`admin`, `api`, `auth`, `app`, `www`, `t`, `onboard`, `landing`).

### 4. Frontend (`src/pages/Onboard.jsx`)
- Add Turnstile widget; pass `captcha_token` in the invoke body.
- Requires `VITE_TURNSTILE_SITE_KEY` (publishable, fine in code).

### 5. Secrets needed
- `TURNSTILE_SECRET_KEY` — request via `add_secret` after user approves plan. (Free Cloudflare Turnstile key.)

### Out of scope
- Existing public flows (`public-register`, `public-wofbi-register`) — they're tenant-scoped, not creating tenants.
- Changing `is_admin()` semantics for super_admin (a separate, riskier refactor).

### Verification
- Anonymous POST without captcha → 400.
- Valid signup → tenant created, user is `owner` + tenant-scoped `admin`, NOT `super_admin`. Confirm via `select role, tenant_id from user_roles where user_id = ...`.
- 4th rapid signup from same IP → 429.
- Existing platform super_admins (`tenant_id IS NULL`) still work.

### Files
- edit `supabase/functions/register-tenant/index.ts`
- new migration: demote rogue super_admins + create `public_signup_attempts` table with RLS deny-all (function uses service role)
- edit `src/pages/Onboard.jsx` (Turnstile widget)
- mark security finding fixed
