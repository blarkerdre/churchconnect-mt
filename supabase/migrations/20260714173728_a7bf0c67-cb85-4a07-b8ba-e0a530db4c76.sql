
-- 1) sla_templates: restrict authenticated read to active versions only
DROP POLICY IF EXISTS "Authenticated can read SLA templates" ON public.sla_templates;
CREATE POLICY "Authenticated can read active SLA templates"
ON public.sla_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2) user_roles: drop policy scoped to public role (defense-in-depth)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- 3) storage.objects: tighten profile_photos_read_restricted to require tenant-scoped admin
DROP POLICY IF EXISTS profile_photos_read_restricted ON storage.objects;
CREATE POLICY profile_photos_read_restricted
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1
        FROM members caller_m
        JOIN members owner_m ON owner_m.tenant_id = caller_m.tenant_id
        WHERE caller_m.user_id = auth.uid()
          AND (owner_m.user_id)::text = (storage.foldername(objects.name))[1]
          AND has_role(auth.uid(), 'admin'::app_role, caller_m.tenant_id)
      )
    )
  )
);
