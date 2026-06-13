
CREATE OR REPLACE FUNCTION public.is_children_church_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND EXISTS (
        SELECT 1
        FROM unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u(name)
        WHERE lower(btrim(u.name)) IN (
          'children church','childrens church','children''s church',
          'children','children ministry','childrens ministry','children''s ministry'
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN (
        'children church','childrens church','children''s church',
        'children','children ministry','childrens ministry','children''s ministry'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_children_church_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN (
        'children church','childrens church','children''s church',
        'children','children ministry','childrens ministry','children''s ministry'
      )
  );
$$;
