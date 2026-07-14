
-- Fix 1: scope is_wsf_leader_for_session to the specific centre (_unit = centre name)
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_session(_user_id uuid, _unit text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'wsf_leader'
      AND ur.tenant_id = _tenant_id
  )
  AND EXISTS (
    SELECT 1
    FROM members m
    JOIN wsf_centres wc
      ON wc.id = m.wsf_centre_id
     AND wc.tenant_id = m.tenant_id
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND (wc.leader_id = m.id OR wc.host_member_id = m.id)
      AND _unit IS NOT NULL
      AND wc.name = _unit
  );
$function$;

-- Fix 2: tighten profile photos read policy
DROP POLICY IF EXISTS profile_photos_read_same_tenant ON storage.objects;

CREATE POLICY profile_photos_read_restricted
ON storage.objects
FOR SELECT
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
          AND has_role(auth.uid(), 'admin'::app_role)
      )
    )
  )
);
