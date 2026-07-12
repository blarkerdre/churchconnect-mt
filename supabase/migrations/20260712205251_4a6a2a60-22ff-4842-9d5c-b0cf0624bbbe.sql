
-- 1) Restrict tenant admins from granting the 'admin' role (prevents privilege escalation).
DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON public.user_roles;
CREATE POLICY "Tenant admins can manage tenant roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
  AND role <> 'admin'::app_role
)
WITH CHECK (
  is_admin(auth.uid(), tenant_id)
  AND role <> 'super_admin'::app_role
  AND role <> 'admin'::app_role
  AND tenant_id IS NOT NULL
);

-- 2) is_reports_officer must not treat NULL tenant_id as wildcard for all tenants.
CREATE OR REPLACE FUNCTION public.is_reports_officer(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'reports_officer'::app_role
      AND tenant_id = _tenant_id
      AND _tenant_id IS NOT NULL
  );
$function$;

-- 3) Harden profile-photos read policy: require the object's storage owner to
-- match the folder-name UUID, so a file misplaced in another user's folder is
-- not readable tenant-wide via the folder-name coupling.
DROP POLICY IF EXISTS "profile_photos_read_same_tenant" ON storage.objects;
CREATE POLICY "profile_photos_read_same_tenant"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    -- Owner reading their own file
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      -- The stored object owner must equal the folder UUID, so a rogue file
      -- placed in another user's folder is not readable.
      AND owner IS NOT NULL
      AND owner::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1
        FROM tenant_memberships caller_tm
        JOIN tenant_memberships owner_tm
          ON owner_tm.tenant_id = caller_tm.tenant_id
        WHERE caller_tm.user_id = auth.uid()
          AND (owner_tm.user_id)::text = (storage.foldername(objects.name))[1]
      )
    )
  )
);
