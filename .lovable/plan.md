## Diagnosis

`mayodare@gmail.com` can still sign in because **her auth account was never deleted** — only her *member* record was removed from the church directory.

Evidence from the database:

- `auth.users` still has her row: `id b0e0d7a8-…`, `deleted_at: null`, `last_sign_in_at: 2026-07-16 11:41:53` (successful login today).
- `public.profiles`, `public.user_roles`, `public.tenant_memberships` for her user_id: **0 rows** (cleared).
- `public.members`: 1 row — she was re-added as a fresh member at 11:33 today (linked back to the same `user_id`).
- Audit log shows repeated `member_delete` actions on her email, but **no `admin-delete-user` / auth deletion event**.

So what has been happening:

1. An admin deletes her from **Members** (Church Management → Members → Delete). That only removes the `members` row and its tenant-scoped data. It does **not** call the `admin-delete-user` edge function, so `auth.users` is untouched.
2. Her Supabase login credentials remain valid, so `signInWithPassword` succeeds.
3. Because she has no `tenant_memberships`, the auto-signout guard on `/auth` (added earlier) is what should immediately kick her back out — that guard is the correct enforcement point, not "prevent sign-in".

Supabase itself has no way to reject a password login based on "no tenant" — the credential is either valid or not. The two real options are:

- **A. Fully delete the auth account** so `signInWithPassword` fails with "Invalid login credentials". Requires the super-admin `admin-delete-user` edge function, which deletes `auth.users` in addition to public tables.
- **B. Keep the auth account, rely on the post-login guard** to sign her out (current behaviour). This is what the recent Auth.jsx changes already implement.

## Recommendation

Pick one — no code change is needed just to *explain* today's login, but to make "delete" actually block future logins we need option A.

### Option A — Wire "Delete member" to also delete the auth account (recommended)

When an admin deletes a member from the Members page, if that member has a linked `user_id` **and** no other `tenant_memberships` remain after the delete, call the existing `admin-delete-user` edge function to remove the auth user too.

Scope of change (single file, presentation/wiring only, no new business logic):

- `src/pages/Members.jsx` (or wherever the member delete handler lives — will confirm on entering build mode):
  1. After the current `members` delete succeeds, if the deleted row had `user_id`, query `tenant_memberships` for that user across all tenants.
  2. If zero remain, invoke `supabase.functions.invoke("admin-delete-user", { body: { user_id } })`.
  3. Show a toast: "Member and login account deleted" vs. "Member deleted (login retained — user still belongs to other churches)".
  4. Requires the deleting admin to be a super_admin (the edge function already enforces this and will 403 otherwise). For non-super-admins we skip the auth delete silently and show "Member deleted (login account retained)".

No DB migration, no RLS change, no changes to `admin-delete-user` itself.

### Option B — Do nothing in code, document the behaviour

The auto-signout guard already blocks her from *using* the app: she lands on `/auth`, sees "No church access", and is signed out. If that is acceptable, we close this as expected behaviour and I'll just add a note.

## Question for you

Which do you want?

- A: Make "Delete member" also delete the auth account when the user has no other tenant memberships (only super_admins get the auth-delete step; others see a clear toast).
- B: Leave as-is — rely on the post-login auto-signout guard.
