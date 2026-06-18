
CREATE OR REPLACE FUNCTION public.list_child_guardians(_child_id uuid, _tenant_id uuid)
RETURNS TABLE (
  id uuid,
  child_id uuid,
  member_id uuid,
  relationship text,
  can_pickup boolean,
  first_name text,
  last_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cg.id, cg.child_id, cg.member_id, cg.relationship, cg.can_pickup,
         m.first_name, m.last_name, m.email, m.phone
  FROM public.child_guardians cg
  JOIN public.members m ON m.id = cg.member_id
  WHERE cg.tenant_id = _tenant_id
    AND cg.child_id = _child_id
    AND public.user_has_tenant_access(_tenant_id)
    AND (
      public.is_admin(auth.uid(), _tenant_id)
      OR public.is_children_church_member(auth.uid(), _tenant_id)
      OR public.is_child_primary_guardian(auth.uid(), _child_id, _tenant_id)
      OR public.is_child_co_parent(auth.uid(), _child_id, _tenant_id)
    );
$$;

REVOKE ALL ON FUNCTION public.list_child_guardians(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_child_guardians(uuid, uuid) TO authenticated;
