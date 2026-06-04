REVOKE ALL ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_assigned_unit_task(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_assigned_unit_task(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_unit_task(uuid, uuid, uuid) TO authenticated, service_role;