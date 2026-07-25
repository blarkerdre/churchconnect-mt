
DROP POLICY IF EXISTS "Children select access" ON public.children;
CREATE POLICY "Children select access"
ON public.children FOR SELECT
USING (
  is_admin(auth.uid(), tenant_id)
  OR is_reports_officer(auth.uid(), tenant_id)
  OR is_children_church_member(auth.uid(), tenant_id)
  OR is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR is_child_co_parent(auth.uid(), id, tenant_id)
  OR is_child_active_today(auth.uid(), id, tenant_id)
);

DROP POLICY IF EXISTS "child_guardians_select" ON public.child_guardians;
DROP POLICY IF EXISTS "Child guardians select" ON public.child_guardians;
CREATE POLICY "Child guardians select"
ON public.child_guardians FOR SELECT
USING (
  is_admin(auth.uid(), tenant_id)
  OR is_reports_officer(auth.uid(), tenant_id)
  OR is_children_church_member(auth.uid(), tenant_id)
  OR is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR is_child_co_parent(auth.uid(), child_id, tenant_id)
);
