CREATE OR REPLACE FUNCTION public.enforce_unit_attendance_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_type text;
  s_unit text;
  m_units text;
BEGIN
  SELECT session_type, unit INTO s_type, s_unit
    FROM public.attendance_sessions WHERE id = NEW.session_id;

  IF s_type = 'Unit Meeting' AND s_unit IS NOT NULL AND length(trim(s_unit)) > 0 THEN
    SELECT church_unit INTO m_units FROM public.members WHERE id = NEW.member_id;
    IF m_units IS NULL OR NOT EXISTS (
      SELECT 1
      FROM unnest(string_to_array(m_units, ',')) AS u
      WHERE lower(trim(u)) = lower(trim(s_unit))
    ) THEN
      RAISE EXCEPTION 'Member is not assigned to unit "%", cannot record attendance for this Unit Meeting.', s_unit
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unit_attendance_eligibility ON public.attendance_records;
CREATE TRIGGER trg_enforce_unit_attendance_eligibility
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_attendance_eligibility();