CREATE OR REPLACE FUNCTION public.reset_checkin_pin(_checkin_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _tenant uuid;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.child_checkins WHERE id = _checkin_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Check-in not found'; END IF;

  IF NOT (public.is_children_church_member(auth.uid(), _tenant) OR public.is_admin(auth.uid(), _tenant)) THEN
    RAISE EXCEPTION 'Only Children Church workers can reset PIN';
  END IF;

  IF _pin IS NULL OR length(_pin) <> 6 THEN RAISE EXCEPTION 'PIN must be 6 digits'; END IF;

  UPDATE public.child_checkins
  SET pin_code_hash = encode(extensions.digest(_pin || '|' || _checkin_id::text, 'sha256'::text), 'hex'),
      updated_at = now()
  WHERE id = _checkin_id AND status = 'checked_in';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reset_checkin_pin(uuid, text) TO authenticated;