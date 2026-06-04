-- Allow app-level admins (user_roles.role='admin') to manage unit tasks
-- Replace inline tenant_memberships checks with is_admin() which covers both paths

-- unit_tasks
DROP POLICY IF EXISTS unit_tasks_select ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_insert ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_update ON public.unit_tasks;
DROP POLICY IF EXISTS unit_tasks_delete ON public.unit_tasks;

CREATE POLICY unit_tasks_select ON public.unit_tasks
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.unit_task_assignments a
    WHERE a.task_id = unit_tasks.id AND a.user_id = auth.uid()
  )
);

CREATE POLICY unit_tasks_insert ON public.unit_tasks
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR public.is_admin(auth.uid(), tenant_id)
    OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
  )
);

CREATE POLICY unit_tasks_update ON public.unit_tasks
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
);

CREATE POLICY unit_tasks_delete ON public.unit_tasks
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.user_leads_unit(auth.uid(), unit_name, tenant_id)
);

-- unit_task_assignments
DROP POLICY IF EXISTS uta_select ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_insert ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_update ON public.unit_task_assignments;
DROP POLICY IF EXISTS uta_delete ON public.unit_task_assignments;

CREATE POLICY uta_select ON public.unit_task_assignments
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
);

CREATE POLICY uta_insert ON public.unit_task_assignments
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
);

CREATE POLICY uta_update ON public.unit_task_assignments
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
);

CREATE POLICY uta_delete ON public.unit_task_assignments
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR public.is_admin(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.unit_tasks t
    WHERE t.id = unit_task_assignments.task_id
      AND public.user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
);