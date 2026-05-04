
CREATE OR REPLACE FUNCTION public.member_eligible_for_session(_member_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.session_type <> 'Unit Meeting'::session_type THEN true
    WHEN s.unit IS NULL OR s.unit = '' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.members m,
           LATERAL unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u
      WHERE m.id = _member_id
        AND lower(btrim(u)) = lower(btrim(s.unit))
    )
  END
  FROM public.attendance_sessions s
  WHERE s.id = _session_id;
$$;

DROP POLICY IF EXISTS "Members can self check-in" ON public.attendance_records;

CREATE POLICY "Members can self check-in"
ON public.attendance_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = attendance_records.member_id
      AND members.user_id = auth.uid()
  )
  AND user_has_tenant_access(tenant_id)
  AND public.member_eligible_for_session(member_id, session_id)
);
