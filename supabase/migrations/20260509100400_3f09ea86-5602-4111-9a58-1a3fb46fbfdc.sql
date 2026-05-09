CREATE OR REPLACE FUNCTION public.member_eligible_for_session(_member_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_sessions s
    JOIN public.members m
      ON m.id = _member_id
     AND m.tenant_id = s.tenant_id
    LEFT JOIN public.wsf_centres c
      ON c.id = m.wsf_centre_id
    WHERE s.id = _session_id
      AND (
        s.unit IS NULL
        OR (
          s.session_type = 'Unit Meeting'
          AND s.unit IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u
            WHERE lower(btrim(u)) = lower(btrim(s.unit))
          )
        )
        OR (
          s.session_type = 'Home Cell Meeting'
          AND s.unit IS NOT NULL
          AND lower(btrim(c.name)) = lower(btrim(s.unit))
        )
      )
  );
$$;