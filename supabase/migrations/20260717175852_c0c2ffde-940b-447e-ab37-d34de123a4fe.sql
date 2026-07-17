
-- 1) Tighten teen_attendance_sessions SELECT
DROP POLICY IF EXISTS teen_sessions_read ON public.teen_attendance_sessions;
CREATE POLICY teen_sessions_read ON public.teen_attendance_sessions
FOR SELECT TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  )
);

-- 2) Tighten wofbi_attendance_records SELECT
DROP POLICY IF EXISTS wofbi_att_records_tenant_read ON public.wofbi_attendance_records;
CREATE POLICY wofbi_att_records_read ON public.wofbi_attendance_records
FOR SELECT TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.user_id = auth.uid() AND m.tenant_id = wofbi_attendance_records.tenant_id
    )
  )
);

-- 3) Enforce tenant_id on non-super_admin user_roles rows
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_tenant_required_for_non_super_admin;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_tenant_required_for_non_super_admin
  CHECK (role = 'super_admin' OR tenant_id IS NOT NULL) NOT VALID;
ALTER TABLE public.user_roles VALIDATE CONSTRAINT user_roles_tenant_required_for_non_super_admin;
