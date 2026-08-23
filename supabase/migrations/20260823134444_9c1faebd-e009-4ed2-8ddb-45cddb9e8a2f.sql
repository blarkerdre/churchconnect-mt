REVOKE EXECUTE ON FUNCTION public.can_admin_member_photo_folder(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_member_photo_folder(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_member_photo_folder(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_member_photo_folder(text) TO authenticated, service_role;
