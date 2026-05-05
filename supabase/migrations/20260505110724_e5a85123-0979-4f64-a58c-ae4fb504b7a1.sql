CREATE OR REPLACE FUNCTION public.member_eligible_for_session(_member_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_sessions s
    JOIN public.members m ON m.id = _member_id
    , LATERAL unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u
    WHERE s.id = _session_id
      AND s.session_type = 'Unit Meeting'
      AND s.unit IS NOT NULL
      AND lower(btrim(u)) = lower(btrim(s.unit))
  );
$$;