

## Plan: Fix Missing User Roles and Memberships in Test Environment

### Problem
Your user (`932364f2-...`) has `super_admin` role and `owner` membership in **Live** but has **neither** in **Test**. The Tenant Admin page queries tenants through RLS, which requires `super_admin` role -- so the query returns empty.

### What We'll Do

**Database inserts (Test environment only):**

1. Insert `user_roles` record: `super_admin` role for your user, scoped to the test tenant
2. Insert `tenant_memberships` record: `owner` role for your user in the test tenant
3. Update your `profiles` record to set `tenant_id` to the test tenant

No code changes needed -- this is a data fix.

### Technical Details

```sql
-- 1. user_roles
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('932364f2-fdf8-4738-bc9d-297edfb51c4d', 'super_admin', 'a0000000-0000-0000-0000-000000000001');

-- 2. tenant_memberships
INSERT INTO tenant_memberships (tenant_id, user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', '932364f2-fdf8-4738-bc9d-297edfb51c4d', 'owner');

-- 3. profiles tenant_id
UPDATE profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE user_id = '932364f2-fdf8-4738-bc9d-297edfb51c4d';
```

After this, the Tenant Admin page will load correctly in Test, showing "Demo Church (TEST)". Live already works and shows "LFC Cardiff".

