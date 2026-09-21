CREATE OR REPLACE FUNCTION public.get_training_attendee_candidates(_tenant_id uuid)
RETURNS TABLE (id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.first_name, m.last_name, m.email
  FROM public.members m
  WHERE m.tenant_id = _tenant_id
    AND public.user_has_tenant_access(_tenant_id)
    AND (
      public.is_admin(auth.uid(), _tenant_id)
      OR public.is_training_rep_member(auth.uid(), _tenant_id)
      OR public.is_training_rep_leader(auth.uid(), _tenant_id)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  ORDER BY m.first_name, m.last_name;
$$;

REVOKE ALL ON FUNCTION public.get_training_attendee_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_attendee_candidates(uuid) TO authenticated;