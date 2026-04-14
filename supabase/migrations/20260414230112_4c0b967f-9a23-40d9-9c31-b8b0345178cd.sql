
-- Helper function: checks if a user is the leader of a WSF centre matching the session's unit field
-- NOTE: wsf_centres.leader_id references members.id, so we join through members to match auth.uid()
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_session(
  _user_id uuid, _unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE m.user_id = _user_id
      AND wc.tenant_id = _tenant_id
      AND lower(wc.name) = lower(COALESCE(_unit, ''))
  )
$$;

-- RLS: WSF leaders can manage WSF Meeting sessions for their centres
CREATE POLICY "WSF leaders can manage WSF sessions"
ON public.attendance_sessions
FOR ALL
TO authenticated
USING (
  session_type = 'WSF Meeting'::session_type
  AND is_wsf_leader_for_session(auth.uid(), unit, tenant_id)
)
WITH CHECK (
  session_type = 'WSF Meeting'::session_type
  AND is_wsf_leader_for_session(auth.uid(), unit, tenant_id)
);

-- RLS: WSF leaders can manage attendance records for their WSF sessions
CREATE POLICY "WSF leaders can manage WSF session records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'WSF Meeting'::session_type
      AND is_wsf_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'WSF Meeting'::session_type
      AND is_wsf_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
);

-- RLS: WSF leaders can view WSF session records (SELECT)
CREATE POLICY "WSF leaders can view WSF session records"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND s.session_type = 'WSF Meeting'::session_type
      AND is_wsf_leader_for_session(auth.uid(), s.unit, s.tenant_id)
  )
);
