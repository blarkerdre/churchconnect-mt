
CREATE OR REPLACE FUNCTION public.user_is_unit_member(_user_id uuid, _unit_name text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m,
         unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS unit
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND lower(btrim(unit)) = lower(btrim(_unit_name))
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_unit_member(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_unit_member(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.task_is_in_user_unit(_user_id uuid, _task_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_tasks t
    WHERE t.id = _task_id
      AND t.tenant_id = _tenant_id
      AND public.user_is_unit_member(_user_id, t.unit_name, _tenant_id)
  );
$$;

REVOKE ALL ON FUNCTION public.task_is_in_user_unit(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_is_in_user_unit(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS unit_tasks_select ON public.unit_tasks;
CREATE POLICY unit_tasks_select ON public.unit_tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_admin(auth.uid(), tenant_id)
  OR user_leads_unit(auth.uid(), unit_name, tenant_id)
  OR user_is_unit_member(auth.uid(), unit_name, tenant_id)
);

DROP POLICY IF EXISTS uta_select ON public.unit_task_assignments;
CREATE POLICY uta_select ON public.unit_task_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR can_manage_unit_task(auth.uid(), task_id, tenant_id)
  OR task_is_in_user_unit(auth.uid(), task_id, tenant_id)
);
