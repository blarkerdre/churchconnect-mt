CREATE OR REPLACE FUNCTION public.can_manage_unit_task(_user_id uuid, _task_id uuid, _tenant_id uuid)
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
      AND (
        public.has_role(_user_id, 'super_admin'::public.app_role)
        OR public.is_admin(_user_id, t.tenant_id)
        OR public.user_leads_unit(_user_id, t.unit_name, t.tenant_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_unit_task(_user_id uuid, _task_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_task_assignments a
    WHERE a.task_id = _task_id
      AND a.tenant_id = _tenant_id
      AND a.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_unit_task(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_assigned_unit_task(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS unit_tasks_select ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_insert ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_update ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_delete ON public.unit_tasks;

CREATE POLICY unit_tasks_select
ON public.unit_tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
  OR public.is_assigned_unit_task(auth.uid(), id, tenant_id)
);

CREATE POLICY unit_tasks_insert
ON public.unit_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.is_admin(auth.uid(), tenant_id)
    OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
  )
);

CREATE POLICY unit_tasks_update
ON public.unit_tasks
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
);

CREATE POLICY unit_tasks_delete
ON public.unit_tasks
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
);

DROP POLICY IF EXISTS uta_select ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_insert ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_update ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_delete ON public.unit_task_assignments;

CREATE POLICY uta_select
ON public.unit_task_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_unit_task(auth.uid(), task_id, tenant_id)
);

CREATE POLICY uta_insert
ON public.unit_task_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_unit_task(auth.uid(), task_id, tenant_id)
);

CREATE POLICY uta_update
ON public.unit_task_assignments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_unit_task(auth.uid(), task_id, tenant_id)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.can_manage_unit_task(auth.uid(), task_id, tenant_id)
);

CREATE POLICY uta_delete
ON public.unit_task_assignments
FOR DELETE
TO authenticated
USING (
  public.can_manage_unit_task(auth.uid(), task_id, tenant_id)
);