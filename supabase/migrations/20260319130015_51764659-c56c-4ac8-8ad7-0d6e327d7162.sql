
CREATE OR REPLACE FUNCTION public.check_attendance_inactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent_sessions uuid[];
BEGIN
  -- Only act when the closed session is a Unit Meeting
  IF NEW.session_type != 'Unit Meeting' THEN
    RETURN NEW;
  END IF;

  -- Get the 3 most recent closed Unit Meeting sessions
  SELECT ARRAY(
    SELECT id FROM public.attendance_sessions
    WHERE status = 'Closed' AND session_type = 'Unit Meeting'
    ORDER BY session_date DESC, created_at DESC
    LIMIT 3
  ) INTO _recent_sessions;

  IF array_length(_recent_sessions, 1) < 3 THEN
    RETURN NEW;
  END IF;

  UPDATE public.members m
  SET membership_status = 'Inactive', updated_at = now()
  WHERE m.membership_status = 'Active'
    AND EXISTS (
      SELECT 1 FROM public.attendance_records ar WHERE ar.member_id = m.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.member_id = m.id
        AND ar.session_id = ANY(_recent_sessions)
    );

  RETURN NEW;
END;
$$;
