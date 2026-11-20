CREATE OR REPLACE FUNCTION public.release_child(_checkin_id uuid, _method text, _pin text DEFAULT NULL::text, _adult_member_id uuid DEFAULT NULL::uuid, _delegation_code text DEFAULT NULL::text, _override_reason text DEFAULT NULL::text, _notes text DEFAULT NULL::text)
 RETURNS child_checkins
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _row public.child_checkins;
  _tenant uuid;
  _ok boolean := false;
  _deleg_id uuid;
  _is_leader boolean;
  _is_worker boolean;
  _is_admin boolean;
  _hash text;
BEGIN
  SELECT * INTO _row FROM public.child_checkins WHERE id = _checkin_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Check-in not found'; END IF;
  IF _row.status = 'picked_up' THEN RAISE EXCEPTION 'Already picked up'; END IF;
  _tenant := _row.tenant_id;

  _is_worker := public.is_children_church_member(auth.uid(), _tenant);
  _is_leader := public.is_children_church_leader(auth.uid(), _tenant);
  _is_admin := public.is_admin(auth.uid(), _tenant);
  IF NOT (_is_worker OR _is_admin) THEN
    RAISE EXCEPTION 'Not authorised to release children';
  END IF;

  IF _method = 'pin' THEN
    IF _pin IS NULL OR _adult_member_id IS NULL THEN RAISE EXCEPTION 'PIN and adult required'; END IF;
    _hash := encode(extensions.digest(_pin || '|' || _checkin_id::text, 'sha256'::text), 'hex');
    IF _hash <> _row.pin_code_hash THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.child_guardians g
      WHERE g.child_id = _row.child_id AND g.member_id = _adult_member_id AND g.can_pickup = true
    ) THEN
      RAISE EXCEPTION 'Adult is not on the authorised pickup list';
    END IF;
    _ok := true;
  ELSIF _method = 'qr' THEN
    IF _adult_member_id IS NULL THEN RAISE EXCEPTION 'Adult required'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.child_guardians g
      WHERE g.child_id = _row.child_id AND g.member_id = _adult_member_id AND g.can_pickup = true
    ) THEN
      RAISE EXCEPTION 'Adult is not on the authorised pickup list';
    END IF;
    _ok := true;
  ELSIF _method = 'delegation_code' THEN
    IF _delegation_code IS NULL THEN RAISE EXCEPTION 'Delegation code required'; END IF;
    _hash := encode(extensions.digest(upper(_delegation_code) || '|' || _row.child_id::text, 'sha256'::text), 'hex');
    SELECT id INTO _deleg_id FROM public.child_pickup_delegations
     WHERE child_id = _row.child_id
       AND tenant_id = _tenant
       AND code_hash = _hash
       AND used_at IS NULL
       AND expires_at > now()
       AND valid_on = _row.service_date
     LIMIT 1;
    IF _deleg_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired delegation code'; END IF;
    UPDATE public.child_pickup_delegations SET used_at = now(), used_by_worker_user_id = auth.uid() WHERE id = _deleg_id;
    _ok := true;
  ELSIF _method = 'leader_override' THEN
    IF NOT (_is_leader OR _is_admin) THEN RAISE EXCEPTION 'Only leaders may override'; END IF;
    IF _override_reason IS NULL OR length(btrim(_override_reason)) < 5 THEN RAISE EXCEPTION 'Override reason required'; END IF;
    _ok := true;
  ELSE
    RAISE EXCEPTION 'Unknown method: %', _method;
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'Release denied'; END IF;

  PERFORM set_config('app.child_checkin_rpc', 'on', true);
  UPDATE public.child_checkins
  SET pickup_at = now(),
      pickup_worker_user_id = auth.uid(),
      pickup_adult_member_id = _adult_member_id,
      pickup_method = _method,
      override_reason = _override_reason,
      notes = COALESCE(notes, '') || CASE WHEN _notes IS NOT NULL THEN E'\n' || _notes ELSE '' END,
      status = 'picked_up'
  WHERE id = _checkin_id
  RETURNING * INTO _row;
  PERFORM set_config('app.child_checkin_rpc', 'off', true);

  RETURN _row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_child_checkin_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin'::app_role, NEW.tenant_id)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Status, PIN and pickup details may only change through the verified
  -- release_child / reset_checkin_pin functions, which set this flag after
  -- checking the guardian PIN, QR, delegation code or leader override.
  IF COALESCE(current_setting('app.child_checkin_rpc', true), '') <> 'on' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.pin_code_hash IS DISTINCT FROM OLD.pin_code_hash
       OR NEW.pickup_adult_member_id IS DISTINCT FROM OLD.pickup_adult_member_id
       OR NEW.pickup_worker_user_id IS DISTINCT FROM OLD.pickup_worker_user_id
       OR NEW.override_reason IS DISTINCT FROM OLD.override_reason
       OR NEW.pickup_delegation_id IS DISTINCT FROM OLD.pickup_delegation_id
       OR NEW.pickup_method IS DISTINCT FROM OLD.pickup_method
       OR NEW.pickup_at IS DISTINCT FROM OLD.pickup_at THEN
      RAISE EXCEPTION 'Pickup must be recorded through the verified release process';
    END IF;
  END IF;

  -- Prevent workers from moving records across tenants or children
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.child_id IS DISTINCT FROM OLD.child_id
     OR NEW.dropoff_worker_user_id IS DISTINCT FROM OLD.dropoff_worker_user_id
     OR NEW.dropoff_parent_member_id IS DISTINCT FROM OLD.dropoff_parent_member_id
     OR NEW.dropoff_at IS DISTINCT FROM OLD.dropoff_at
     OR NEW.service_date IS DISTINCT FROM OLD.service_date THEN
    RAISE EXCEPTION 'Only admins can modify drop-off/tenant fields on a check-in';
  END IF;

  RETURN NEW;
END;
$function$;

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

  PERFORM set_config('app.child_checkin_rpc', 'on', true);
  UPDATE public.child_checkins
  SET pin_code_hash = encode(extensions.digest(_pin || '|' || _checkin_id::text, 'sha256'::text), 'hex'),
      updated_at = now()
  WHERE id = _checkin_id AND status = 'checked_in';
  PERFORM set_config('app.child_checkin_rpc', 'off', true);
END;
$function$;