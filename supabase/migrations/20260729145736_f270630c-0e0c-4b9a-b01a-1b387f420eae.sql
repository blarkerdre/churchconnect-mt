DROP POLICY IF EXISTS utc_insert ON public.unit_task_comments;
CREATE POLICY utc_insert ON public.unit_task_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.user_id = auth.uid() AND tm.tenant_id = unit_task_comments.tenant_id AND tm.role = ANY (ARRAY['owner'::tenant_role,'admin'::tenant_role]))
    OR EXISTS (SELECT 1 FROM unit_tasks t WHERE t.id = unit_task_comments.task_id AND user_leads_unit(auth.uid(), t.unit_name, t.tenant_id))
    OR EXISTS (
      SELECT 1 FROM unit_task_assignments a
      JOIN unit_tasks t2 ON t2.id = a.task_id
      WHERE a.task_id = unit_task_comments.task_id AND a.user_id = auth.uid() AND t2.status = 'Open'
    )
  )
);