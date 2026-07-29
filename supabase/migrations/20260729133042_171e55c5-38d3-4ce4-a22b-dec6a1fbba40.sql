DROP POLICY IF EXISTS "Child checkins select" ON public.child_checkins;
CREATE POLICY "Child checkins select" ON public.child_checkins
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  OR is_reports_officer(auth.uid(), tenant_id)
  OR is_children_church_leader(auth.uid(), tenant_id)
  OR is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR is_child_co_parent(auth.uid(), child_id, tenant_id)
  OR (is_children_church_member(auth.uid(), tenant_id) AND service_date = CURRENT_DATE)
);