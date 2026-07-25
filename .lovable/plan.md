## Goal
Let super admins moderate any tenant's members, remove the duplicate Akinmolayan row, and stop the public/first-timer flow from creating duplicate member rows for the same email in a tenant.

## 1. Super-admin bypass on core member operations

Add a `public.has_role(auth.uid(), 'super_admin')` clause to RLS policies on `members` so super admins can SELECT/UPDATE/DELETE across any tenant without being added as a tenant admin.

- Migration: recreate the relevant `members` policies (delete, update, select as needed) with `USING (... OR public.has_role(auth.uid(), 'super_admin'))`.
- Apply the same super-admin OR-clause to closely-coupled tables that block a member delete cascade or moderation view: `attendance_records`, `followups`, `pastoral_care`, `transportation`, `event_registrations`, `course_registrations`, `wofbi_applications`, `member_status_history`, `tenant_memberships` (delete only).
- Keep existing tenant-scoped conditions intact — super_admin is purely additive.
- No client changes required; the existing delete flow in `src/pages/Members.jsx` already unlinks WSF leadership and calls `admin-delete-user` — it will succeed once RLS permits.

## 2. Clean up the duplicate Akinmolayan record

One-off SQL in the same migration:

- Delete `members` row `bcd6c190…` (Visitor, no `user_id`, no dependent rows) in tenant WCI Cardiff.
- Keep `7529f503…` (Active, linked user, has attendance).
- Guarded by explicit `id =` + `tenant_id =` + `user_id IS NULL` so it can't hit the wrong row.

## 3. Prevent future duplicates from public / first-timer registration

Deduplicate on `(tenant_id, lower(email))` at the entry points instead of always inserting:

- `supabase/functions/public-register/index.ts` and any first-timer/self-registration edge functions: before insert, `select id from members where tenant_id = $1 and lower(email) = lower($2) limit 1`. If found, `update` the existing row (fill blanks, refresh consent/status where appropriate) and return that id; otherwise insert.
- Same guard in the in-app "Register Member" path in `MemberFormDialog` when creating (not editing) — surface a "A member with this email already exists — open their profile?" confirmation instead of silently inserting.
- Add a partial unique index `create unique index members_tenant_email_uidx on public.members (tenant_id, lower(email)) where email is not null;` after the cleanup step, so the database enforces it going forward.

## Technical notes
- All policy changes use `create policy` / `drop policy` in a single migration; GRANTs on `members` already exist and don't need to change.
- The unique index must run AFTER the duplicate cleanup or it will fail. Before creating it, the migration also runs a safety query to detect any other tenant/email duplicates and abort with a clear error if found (so we don't silently drop data).
- No UI redesign; Members page keeps its current delete confirmation dialog.

## Out of scope
- Bulk merging of any other historical duplicates (only Akinmolayan's is addressed here).
- Changing tenant-scoping semantics for non-member tables beyond the OR super_admin clause.
