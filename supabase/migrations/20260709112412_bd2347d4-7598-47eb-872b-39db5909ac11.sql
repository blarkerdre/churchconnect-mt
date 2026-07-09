
REVOKE EXECUTE ON FUNCTION public.ensure_church_unit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_member_unit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_member_unit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_role_church_unit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_house_provider_unit() FROM PUBLIC, anon, authenticated;
