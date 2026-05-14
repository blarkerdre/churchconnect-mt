-- 1) user_roles: scope admin SELECT to the row's tenant
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (
  is_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 2) wsf_zones: scope admin manage to the row's tenant
DROP POLICY IF EXISTS "Admins can manage wsf zones" ON public.wsf_zones;
CREATE POLICY "Admins can manage wsf zones"
ON public.wsf_zones
FOR ALL
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- 3) storage.objects: book-covers upload must be tenant-scoped admin
DROP POLICY IF EXISTS "Admins upload book covers" ON storage.objects;
CREATE POLICY "Admins upload book covers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'book-covers'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 4) storage.objects: profile-photos read - own folder, or tenant admin/leader for tenant assets
DROP POLICY IF EXISTS "Authenticated read profile photos" ON storage.objects;
CREATE POLICY "Authenticated read profile photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND (
    -- Member can read files inside their own user folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      -- Tenant assets (logos, OG images) live under <tenant_id>/...
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
    )
  )
);