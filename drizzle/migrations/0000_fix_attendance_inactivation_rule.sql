-- Rebuild the auto-inactivation rule so it is unit-scoped, case-insensitive and recent-only
CREATE OR REPLACE FUNCTION public.check_attendance_inactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _unit text;
  _recent_sessions uuid[];
BEGIN
  IF NEW.session_type != 'Unit Meeting' THEN
    RETURN NEW;
  END IF;

  _unit := NEW.unit;
  IF _unit IS NULL OR btrim(_unit) = '' THEN
    RETURN NEW;
  END IF;

  -- last 3 closed meetings of THIS unit, in this tenant, within the last 120 days
  SELECT ARRAY(
    SELECT id FROM public.attendance_sessions
    WHERE lower(status) = 'closed'
      AND session_type = 'Unit Meeting'
      AND lower(btrim(unit)) = lower(btrim(_unit))
      AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
      AND session_date >= (CURRENT_DATE - INTERVAL '120 days')
    ORDER BY session_date DESC, created_at DESC
    LIMIT 3
  ) INTO _recent_sessions;

  IF COALESCE(array_length(_recent_sessions, 1), 0) < 3 THEN
    RETURN NEW;
  END IF;

  UPDATE public.members m
  SET membership_status = 'Inactive', updated_at = now()
  WHERE m.membership_status = 'Active'
    AND m.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
    AND lower(btrim(COALESCE(m.church_unit, ''))) = lower(btrim(_unit))
    -- only people who were expected: they attended this unit before
    AND EXISTS (
      SELECT 1
      FROM public.attendance_records ar
      JOIN public.attendance_sessions s ON s.id = ar.session_id
      WHERE ar.member_id = m.id
        AND s.session_type = 'Unit Meeting'
        AND lower(btrim(COALESCE(s.unit, ''))) = lower(btrim(_unit))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.member_id = m.id
        AND ar.session_id = ANY(_recent_sessions)
    );

  RETURN NEW;
END;
$function$;

-- Fire on any close, regardless of how the status text was cased
DROP TRIGGER IF EXISTS trg_check_inactivation ON public.attendance_sessions;
CREATE TRIGGER trg_check_inactivation
AFTER UPDATE ON public.attendance_sessions
FOR EACH ROW
WHEN (lower(new.status) = 'closed' AND lower(COALESCE(old.status,'')) IS DISTINCT FROM 'closed')
EXECUTE FUNCTION public.check_attendance_inactivation();