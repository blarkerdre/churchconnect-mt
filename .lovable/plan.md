## Findings & disposition

### 1. `is_admin_no_tenant_scope` — **fix** (real cross-tenant escalation)

Three policies use the unscoped overload. Rewrite each to use `is_admin(auth.uid(), <tenant_id>)`:

- `public.user_roles` → policy **"Admins can view all roles"** (SELECT)
- `public.wsf_zones` → policy **"Admins can manage wsf zones"** (ALL)
- `storage.objects` → policy **"Admins upload book covers"** (INSERT)

For `wsf_zones` and `user_roles` the table already has a `tenant_id` column — swap `is_admin(auth.uid())` for `is_admin(auth.uid(), tenant_id)`. The redundant `user_has_tenant_access(tenant_id)` becomes unnecessary (the scoped `is_admin` already verifies tenant membership) but I'll leave it for defence in depth.

For the storage `book-covers` upload: book covers are stored under `${tenantId}/...` (matches the existing **"Tenant-scoped update/delete book-covers"** policies). Rewrite as:

```sql
(bucket_id = 'book-covers'
 AND (storage.foldername(name))[1] IS NOT NULL
 AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
```

Migration: `DROP POLICY` + `CREATE POLICY` for each.

### 2. `profile_photos_bucket_cross_tenant_read` — **partial fix + flag**

The current SELECT policy lets any tenant member read every file under that tenant's folder prefix. **Fix the policy** (tighten to: own folder, OR tenant admin/leader of the tenant prefix), so the metadata/list API stops leaking other members' personal photos.

New `storage.objects` SELECT policy for `profile-photos`:
```sql
bucket_id = 'profile-photos'
AND (
  (storage.foldername(name))[1] = auth.uid()::text                             -- own user folder
  OR (
    (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'                       -- tenant_id folder (logos, OG images)
    AND (
      is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
    )
  )
)
```

**Important caveat I'll surface to the user (no code change in this task):** the `profile-photos` bucket is currently `public = true`, so anyone holding a `getPublicUrl()` link can still read the file regardless of RLS. The directory and dashboard code uses `getPublicUrl` for member photos, which is why broad read worked. To fully close the GDPR concern we'd need a follow-up: flip the bucket private, switch every `getPublicUrl` call (Members table, BirthdayCelebration, MemberDashboard, PendingJoinRequests, WSFLeaderDashboard, etc.) to short-lived `createSignedUrl` requests, and add a tenant-membership read policy. That's a separate, bigger refactor — I'll list affected files and recommend it but will not do it here unless you ask.

### 3. `exam_questions_member_read_blocked` — **ignore (false positive)**

Members never read `public.exam_questions` directly. `TakeExamDialog.jsx` calls the SECURITY DEFINER RPC `get_exam_questions_safe(_subject_id, _training_type)` which returns the questions without `correct_answer`. Admin/leader management goes through `get_exam_questions_with_answers` (also SECURITY DEFINER, role-gated). Granting members direct table SELECT would *re-introduce* an answer-leak risk because the column is on the same table.

I'll mark this finding as ignored with that explanation and update the security memory.

## Files / actions

- New migration:
  - drop + recreate the 3 unscoped `is_admin` policies (tenant-scoped)
  - drop + recreate the `profile-photos` SELECT policy
- `manage_security_finding`:
  - mark `is_admin_no_tenant_scope` fixed
  - mark `profile_photos_bucket_cross_tenant_read` fixed (with caveat)
  - ignore `exam_questions_member_read_blocked` (RPC-only access pattern)
- `update_memory` — record: book-covers/profile-photos use tenant_id folder prefix; exam questions are read via SECURITY DEFINER RPCs; if anyone changes that, restore proper RLS.

## Verification

- Re-run policy query → no policy expression contains `is_admin(auth.uid())` (single-arg).
- Sign in as Tenant A admin, attempt SELECT on a Tenant B `wsf_zones` row → blocked.
- As Member X in Tenant A, list `profile-photos/<member-Y-uuid>/...` via SDK → empty (own folder still works).
- Member takes an exam via `TakeExamDialog` → questions still load (RPC unchanged).

## Out of scope (recommend as follow-up)

- Make `profile-photos` bucket private and convert all `getPublicUrl` member-photo reads to `createSignedUrl`. Files affected: `MyProfile.jsx`, `Settings.jsx`, `Members*.jsx`, `BirthdayCelebration.jsx`, `MemberDashboard.jsx`, `PendingJoinRequests.jsx`, `WSFLeaderDashboard.jsx`, plus any avatar usage in feeds.
