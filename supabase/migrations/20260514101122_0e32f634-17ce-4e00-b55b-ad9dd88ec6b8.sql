-- Demote any tenant-scoped super_admin rows created by the public self-serve register-tenant flow.
-- Platform super_admins (tenant_id IS NULL) are unaffected.
UPDATE public.user_roles
SET role = 'admin'
WHERE role = 'super_admin'
  AND tenant_id IS NOT NULL;