-- 1) Exam results are recorded only by the marking service or church admins.
CREATE OR REPLACE FUNCTION public.exam_attempts_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT public.is_admin(auth.uid(), NEW.tenant_id) THEN
    RAISE EXCEPTION 'Exam results can only be recorded by the marking service';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_exam_attempts_guard_insert ON public.exam_attempts;
CREATE TRIGGER trg_exam_attempts_guard_insert
BEFORE INSERT ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.exam_attempts_guard_insert();

-- 2) Life event requests: members can't choose who approves them or approve themselves.
CREATE OR REPLACE FUNCTION public.is_life_event_approver(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.rpc_probe_blocked('is_life_event_approver', _user_id) THEN RETURN false; END IF;
  IF _user_id IS NULL OR _tenant_id IS NULL THEN RETURN false; END IF;
  RETURN public.is_admin(_user_id, _tenant_id)
    OR EXISTS (SELECT 1 FROM public.unit_leader_assignments WHERE user_id = _user_id AND tenant_id = _tenant_id)
    OR EXISTS (SELECT 1 FROM public.wsf_centres WHERE leader_id = _user_id AND tenant_id = _tenant_id);
END $function$;

REVOKE ALL ON FUNCTION public.is_life_event_approver(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_life_event_approver(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.life_event_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _altar boolean;
BEGIN
  IF current_user NOT IN ('authenticated','anon')
     OR public.has_role(_uid, 'super_admin'::app_role)
     OR public.is_admin(_uid, NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.stage := 'awaiting_leader';
    NEW.stage1_approved_by := NULL; NEW.stage1_approved_at := NULL; NEW.stage1_note := NULL;
    NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
    NEW.final_approved_by := NULL; NEW.final_approved_at := NULL;
    NEW.assigned_owner_id := NULL; NEW.assigned_pastor_ids := '{}';
    NEW.completed_at := NULL; NEW.completed_by := NULL;
    NEW.route_user_ids := ARRAY(
      SELECT DISTINCT u FROM unnest(coalesce(NEW.route_user_ids, '{}')) u
      WHERE u IS DISTINCT FROM _uid AND public.is_life_event_approver(u, NEW.tenant_id));
    IF coalesce(array_length(NEW.route_user_ids, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Please select at least one approver (Home Cell Leader or Unit Leader) other than yourself';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.pastoral_care_id IS DISTINCT FROM OLD.pastoral_care_id
     OR NEW.approval_route IS DISTINCT FROM OLD.approval_route
     OR NEW.route_user_ids IS DISTINCT FROM OLD.route_user_ids THEN
    RAISE EXCEPTION 'Who a life event request is for and who approves it cannot be changed';
  END IF;

  IF OLD.created_by = _uid AND (
       NEW.stage IS DISTINCT FROM OLD.stage
    OR NEW.final_approved_by IS DISTINCT FROM OLD.final_approved_by
    OR NEW.assigned_owner_id IS DISTINCT FROM OLD.assigned_owner_id
    OR NEW.assigned_pastor_ids IS DISTINCT FROM OLD.assigned_pastor_ids) THEN
    RAISE EXCEPTION 'You cannot approve or assign your own life event request';
  END IF;

  _altar := public.is_altar_ministry_leader(_uid, NEW.tenant_id);

  IF (NEW.final_approved_by IS DISTINCT FROM OLD.final_approved_by
      OR NEW.final_approved_at IS DISTINCT FROM OLD.final_approved_at
      OR NEW.assigned_owner_id IS DISTINCT FROM OLD.assigned_owner_id
      OR NEW.assigned_pastor_ids IS DISTINCT FROM OLD.assigned_pastor_ids) AND NOT _altar THEN
    RAISE EXCEPTION 'Only the Altar Ministry leaders can give final approval';
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF OLD.stage = 'awaiting_leader' AND NEW.stage IN ('awaiting_altar_ministry','rejected') THEN
      IF NOT (_uid = ANY(OLD.route_user_ids) OR _altar) THEN
        RAISE EXCEPTION 'Only the chosen leaders can review this request';
      END IF;
      IF NEW.stage = 'awaiting_altar_ministry' THEN
        NEW.stage1_approved_by := _uid;
      END IF;
    ELSIF OLD.stage IN ('awaiting_altar_ministry','approved') AND NEW.stage IN ('approved','rejected') THEN
      IF NOT _altar THEN
        RAISE EXCEPTION 'Only the Altar Ministry leaders can give final approval';
      END IF;
    ELSIF OLD.stage = 'approved' AND NEW.stage = 'completed' THEN
      IF NOT (_altar OR _uid = OLD.assigned_owner_id OR _uid = ANY(coalesce(OLD.assigned_pastor_ids,'{}'))) THEN
        RAISE EXCEPTION 'Only the assigned team can mark this as completed';
      END IF;
      NEW.completed_by := _uid;
    ELSE
      RAISE EXCEPTION 'This change to the request is not allowed';
    END IF;
  ELSIF NEW.stage1_approved_by IS DISTINCT FROM OLD.stage1_approved_by
     OR NEW.stage1_approved_at IS DISTINCT FROM OLD.stage1_approved_at
     OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by THEN
    RAISE EXCEPTION 'This change to the request is not allowed';
  END IF;

  IF NEW.final_approved_by IS DISTINCT FROM OLD.final_approved_by AND NEW.final_approved_by IS NOT NULL THEN
    NEW.final_approved_by := _uid;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_life_event_requests_guard ON public.life_event_requests;
CREATE TRIGGER trg_life_event_requests_guard
BEFORE INSERT OR UPDATE ON public.life_event_requests
FOR EACH ROW EXECUTE FUNCTION public.life_event_requests_guard();

-- 3) Transport bookings: passengers can't confirm their own booking or pick its driver/handler.
CREATE OR REPLACE FUNCTION public.transportation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _skip text[] := ARRAY['passenger_acknowledged_at','updated_at'];
BEGIN
  IF current_user NOT IN ('authenticated','anon')
     OR public.has_role(_uid, 'super_admin'::app_role)
     OR public.is_admin(_uid, NEW.tenant_id)
     OR public.has_role(_uid, 'unit_leader'::app_role, NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'Pending';
    NEW.assigned_to := NULL; NEW.assigned_at := NULL;
    NEW.driver_user_id := NULL; NEW.assigned_driver := NULL; NEW.driver_phone := NULL;
    NEW.auto_matched := false; NEW.pickup_order := NULL;
    NEW.notified_at := NULL; NEW.checked_in_at := NULL; NEW.picked_up_at := NULL; NEW.no_show_at := NULL;
    NEW.passenger_acknowledged_at := NULL; NEW.checkin_notes := NULL;
    RETURN NEW;
  END IF;

  IF _uid = OLD.assigned_to OR _uid = OLD.driver_user_id THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.driver_user_id IS DISTINCT FROM OLD.driver_user_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.member_id IS DISTINCT FROM OLD.member_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Only transport leaders can change who handles or drives a booking';
    END IF;
    RETURN NEW;
  END IF;

  -- Passenger: may only acknowledge their booking.
  IF (to_jsonb(NEW) - _skip) IS DISTINCT FROM (to_jsonb(OLD) - _skip) THEN
    RAISE EXCEPTION 'Passengers can only acknowledge their booking; ask a transport leader to make changes';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_transportation_guard ON public.transportation;
CREATE TRIGGER trg_transportation_guard
BEFORE INSERT OR UPDATE ON public.transportation
FOR EACH ROW EXECUTE FUNCTION public.transportation_guard();