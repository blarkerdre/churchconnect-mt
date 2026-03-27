

## Fix: Cross-Tenant Admin Escalation on 3 Tables

### Problem

`wsf_zones`, `exam_subjects`, and `user_roles` RLS policies use `is_admin(auth.uid())` (single-arg) which returns true for admins of **any** tenant. Combined with `user_has_tenant_access(tenant_id)`, an admin in Tenant A who is a regular member in Tenant B can manage data in Tenant B.

### Fix

One migration to drop and recreate the affected policies using `is_admin(auth.uid(), tenant_id)`:

**`wsf_zones`** — replace `is_admin(auth.uid())` with `is_admin(auth.uid(), tenant_id)` in the admin management policy

**`exam_subjects`** — replace `is_admin(auth.uid())` with `is_admin(auth.uid(), tenant_id)` in the admin management policy, remove redundant `user_has_tenant_access(tenant_id)` (already implied by tenant-scoped `is_admin`)

**`user_roles`** — replace `is_admin(auth.uid())` with `is_admin(auth.uid(), tenant_id)` in the SELECT policy

### Files changed

- **One database migration** — drop and recreate 3 RLS policies with tenant-scoped admin checks

