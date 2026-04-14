
-- 1. Helper function
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_session(
  _user_id uuid, _unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(ula.unit_name) = lower(COALESCE(_unit, ''))
  )
$$;

-- 2. attendance_sessions: drop old broad policy, add scoped ones
DROP POLICY IF EXISTS "Admins/leaders can manage sessions" ON public.attendance_sessions;

CREATE POLICY "Admins can manage all sessions"
ON public.attendance_sessions
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Unit leaders can manage unit sessions"
ON public.attendance_sessions
FOR ALL
TO authenticated
USING (
  session_type = 'Unit Meeting'
  AND is_unit_leader_for_session(auth.uid(), unit, tenant_id)
)
WITH CHECK (
  session_type = 'Unit Meeting'
  AND is_unit_leader_for_session(auth.uid(), unit, tenant_id)
);

-- 3. attendance_records: drop old broad policies, add scoped ones
DROP POLICY IF EXISTS "Admins and leaders can view all attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins/leaders can manage records" ON public.attendance_records;

CREATE POLICY "Admins can manage all records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

CREATE POLICY "Unit leaders can view unit session records"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'Unit Meeting'
      AND is_unit_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
);

CREATE POLICY "Unit leaders can manage unit session records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'Unit Meeting'
      AND is_unit_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'Unit Meeting'
      AND is_unit_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
);
