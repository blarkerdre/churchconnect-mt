## Goal

1. Delete `mayodare@gmail.com`'s orphan auth account now.
2. Add a scheduled cleanup that periodically removes any `auth.users` with zero `tenant_memberships` (and no super-admin role).

## Step 1 — Delete mayodare now

Call `admin-delete-user` for `user_id = b0e0d7a8-8fad-4a49-9e84-63ceb853fd78` from an authenticated super-admin session. She has 0 rows in `profiles`, `user_roles`, `tenant_memberships`, `members` so the impact is limited to removing the auth row.

I'll trigger it via `supabase.functions.invoke` in the browser context (super-admin logged in) — or via a one-off `curl_edge_functions` call with an explicit super-admin bearer.

## Step 2 — Scheduled orphan cleanup

**New edge function**: `supabase/functions/cleanup-orphan-auth-users/index.ts`
- Uses service role.
- No caller check (invoked by pg_cron with anon key + secret header, or via internal cron). Guard with a shared secret header `x-cron-secret` compared to a new secret `CRON_ORPHAN_CLEANUP_SECRET`.
- Logic:
  1. Load `auth.users` (via `admin.listUsers`, paged).
  2. For each user, skip if:
     - has any `tenant_memberships` row, OR
     - has any `user_roles` row with role `super_admin`, OR
     - created within the last 24 hours (avoid deleting brand-new signups mid-onboarding).
  3. Otherwise call `admin.deleteUser(id)`.
  4. Insert a summary row into `audit_log` with `tenant_id = null`, action `orphan_auth_cleanup`, count deleted, and list of user_ids/emails.
- Returns `{ scanned, deleted, skipped }`.

**Secret**: generate `CRON_ORPHAN_CLEANUP_SECRET` (random 48 chars) via `generate_secret`.

**Cron job** (via `supabase--insert`, not migration, since it embeds project URL + anon key):
```sql
select cron.schedule(
  'cleanup-orphan-auth-users-daily',
  '15 3 * * *',        -- daily at 03:15 UTC
  $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/cleanup-orphan-auth-users',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','<ANON_KEY>',
      'x-cron-secret','<CRON_ORPHAN_CLEANUP_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
Prereq: enable `pg_cron` and `pg_net` extensions (migration).

## Files to change

- `supabase/functions/cleanup-orphan-auth-users/index.ts` — new
- Migration: `create extension if not exists pg_cron; create extension if not exists pg_net;`
- `supabase--insert`: schedule the cron job
- `secrets--generate_secret`: `CRON_ORPHAN_CLEANUP_SECRET`
- One-off invoke: delete mayodare's `user_id` immediately

## Out of scope

- No UI surface for orphan cleanup (runs silently on cron).
- No change to `admin-delete-user`.
- No change to the Members delete flow (already fixed last turn).

## Risks / notes

- The 24-hour skip prevents killing accounts of users who signed up but haven't been added to a tenant yet.
- Super-admins without a `tenant_memberships` row are protected by the `user_roles` check.
- Cron secret prevents public invocation.