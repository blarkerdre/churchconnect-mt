CREATE OR REPLACE FUNCTION public.is_teens_unit_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry','teens church','teen church')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teens_unit_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_teens_unit_leader(_user_id, _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = _user_id
        AND m.tenant_id = _tenant_id
        AND m.church_unit IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(string_to_array(m.church_unit, ',')) AS u(name)
          WHERE lower(btrim(u.name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry','teens church','teen church')
        )
    );
$$;