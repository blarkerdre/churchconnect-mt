-- Admin-managed member photo folders: "member-<member id>/..."

CREATE OR REPLACE FUNCTION public.can_admin_member_photo_folder(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _folder LIKE 'member-%'
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE 'member-' || m.id::text = _folder
        AND (
          public.has_role(auth.uid(), 'super_admin'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role, m.tenant_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_member_photo_folder(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _folder LIKE 'member-%'
    AND EXISTS (
      SELECT 1
      FROM public.members owner_m
      JOIN public.members caller_m ON caller_m.tenant_id = owner_m.tenant_id
      WHERE 'member-' || owner_m.id::text = _folder
        AND caller_m.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_admin_member_photo_folder(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_member_photo_folder(text) TO authenticated;

CREATE POLICY "profile_photos_admin_member_folder_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND public.can_admin_member_photo_folder((storage.foldername(name))[1])
);

CREATE POLICY "profile_photos_admin_member_folder_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND public.can_admin_member_photo_folder((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND public.can_admin_member_photo_folder((storage.foldername(name))[1])
);

CREATE POLICY "profile_photos_admin_member_folder_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND public.can_admin_member_photo_folder((storage.foldername(name))[1])
);

CREATE POLICY "profile_photos_member_folder_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND public.can_view_member_photo_folder((storage.foldername(name))[1])
);
