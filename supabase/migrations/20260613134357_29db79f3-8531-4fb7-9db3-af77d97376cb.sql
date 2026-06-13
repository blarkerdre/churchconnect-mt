CREATE OR REPLACE FUNCTION public.checkin_child(_child_id uuid, _pin text, _parent_member_id uuid)
 RETURNS child_checkins
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _tenant uuid;
  _new_id uuid := gen_random_uuid();
  _row public.child_checkins;
  _child_name text;
BEGIN
  SELECT tenant_id, first_name || ' ' || last_name
    INTO _tenant, _child_name
  FROM public.children WHERE id = _child_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Child not found'; END IF;

  IF NOT (public.is_children_church_member(auth.uid(), _tenant) OR public.is_admin(auth.uid(), _tenant)) THEN
    RAISE EXCEPTION 'Only Children Church workers can check in';
  END IF;
  IF _pin IS NULL OR length(_pin) <> 6 THEN RAISE EXCEPTION 'PIN must be 6 digits'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_checkins
    WHERE child_id = _child_id AND status = 'checked_in'
  ) THEN
    RAISE EXCEPTION '% is already checked in. Please pick them up first.', COALESCE(_child_name, 'Child');
  END IF;

  INSERT INTO public.child_checkins(
    id, tenant_id, child_id, service_date, dropoff_at, dropoff_worker_user_id,
    dropoff_parent_member_id, pin_code_hash, status
  ) VALUES (
    _new_id, _tenant, _child_id, CURRENT_DATE, now(), auth.uid(),
    _parent_member_id,
    encode(extensions.digest(_pin || '|' || _new_id::text, 'sha256'::text), 'hex'),
    'checked_in'
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$function$;