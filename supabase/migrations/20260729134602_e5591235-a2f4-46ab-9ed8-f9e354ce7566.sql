
-- ============ TABLES ============
CREATE TABLE public.preteens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  primary_guardian_member_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text,
  photo_url text,
  access_pin_hash text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  attendance_consent boolean NOT NULL DEFAULT false,
  attendance_consent_at timestamptz,
  attendance_consent_by uuid,
  data_processing_consent boolean NOT NULL DEFAULT false,
  data_processing_consent_at timestamptz,
  data_processing_consent_by uuid,
  self_pin_hash text,
  self_pin_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.preteen_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  session_type text,
  notes text,
  session_date date NOT NULL,
  start_time time,
  end_time time,
  late_after time,
  status text NOT NULL DEFAULT 'open',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX preteen_sessions_qr_token_idx ON public.preteen_attendance_sessions(qr_token);

CREATE TABLE public.preteen_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.preteen_attendance_sessions(id) ON DELETE CASCADE,
  preteen_id uuid NOT NULL REFERENCES public.preteens(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by uuid,
  checked_out_at timestamptz,
  checked_out_by uuid,
  duration_minutes integer,
  source text NOT NULL DEFAULT 'qr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX preteen_records_session_preteen_idx ON public.preteen_attendance_records(session_id, preteen_id);

CREATE TABLE public.preteen_self_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  preteen_id uuid NOT NULL REFERENCES public.preteens(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.preteen_attendance_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preteens TO authenticated;
GRANT ALL ON public.preteens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preteen_attendance_sessions TO authenticated;
GRANT ALL ON public.preteen_attendance_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preteen_attendance_records TO authenticated;
GRANT ALL ON public.preteen_attendance_records TO service_role;
GRANT SELECT, UPDATE ON public.preteen_self_enrolments TO authenticated;
GRANT ALL ON public.preteen_self_enrolments TO service_role;

-- ============ RLS ============
ALTER TABLE public.preteens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preteen_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preteen_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preteen_self_enrolments ENABLE ROW LEVEL SECURITY;

CREATE POLICY preteens_read ON public.preteens FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = preteens.primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = preteens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
);
CREATE POLICY preteens_insert ON public.preteens FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = preteens.primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = preteens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);
CREATE POLICY preteens_update ON public.preteens FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = preteens.primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = preteens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
)
WITH CHECK (public.user_has_tenant_access(tenant_id));
CREATE POLICY preteens_delete ON public.preteens FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = preteens.primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = preteens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY preteen_sessions_read ON public.preteen_attendance_sessions FOR SELECT TO authenticated
USING (public.user_has_tenant_access(tenant_id) AND (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id)));
CREATE POLICY preteen_sessions_insert ON public.preteen_attendance_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id));
CREATE POLICY preteen_sessions_update ON public.preteen_attendance_sessions FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id))
WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id));
CREATE POLICY preteen_sessions_delete ON public.preteen_attendance_sessions FOR DELETE TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_leader(auth.uid(), tenant_id));

CREATE POLICY preteen_records_read ON public.preteen_attendance_records FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.preteens t JOIN public.members m ON m.id = t.primary_guardian_member_id
    WHERE t.id = preteen_attendance_records.preteen_id AND m.user_id = auth.uid() AND t.tenant_id = preteen_attendance_records.tenant_id
  )
);
CREATE POLICY preteen_records_write ON public.preteen_attendance_records FOR ALL TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id))
WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id));

CREATE POLICY preteen_self_enrolments_worker_select ON public.preteen_self_enrolments FOR SELECT TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id));
CREATE POLICY preteen_self_enrolments_worker_update ON public.preteen_self_enrolments FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id))
WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_children_church_member(auth.uid(), tenant_id));

-- ============ TRIGGERS ============
CREATE TRIGGER preteens_updated_at BEFORE UPDATE ON public.preteens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER preteen_sessions_updated_at BEFORE UPDATE ON public.preteen_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER preteen_records_updated_at BEFORE UPDATE ON public.preteen_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER preteen_self_enrolments_updated_at BEFORE UPDATE ON public.preteen_self_enrolments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.restrict_preteen_session_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF public.is_admin(auth.uid(), NEW.tenant_id)
     OR public.is_children_church_leader(auth.uid(), NEW.tenant_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.session_type IS DISTINCT FROM OLD.session_type
     OR NEW.session_date IS DISTINCT FROM OLD.session_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.late_after IS DISTINCT FROM OLD.late_after
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.qr_token IS DISTINCT FROM OLD.qr_token
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Only Children''s Church unit leaders or admins can edit session details';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER preteen_sessions_restrict_updates BEFORE UPDATE ON public.preteen_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.restrict_preteen_session_updates();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.get_preteen_session_by_token(_qr_token uuid)
RETURNS TABLE(id uuid, title text, session_date date, status text, tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT s.id, s.title, s.session_date, s.status, s.tenant_id
  FROM public.preteen_attendance_sessions s
  WHERE s.qr_token = _qr_token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.list_open_preteen_sessions(_tenant_slug text)
RETURNS TABLE(id uuid, title text, session_date date, start_time time without time zone, qr_token uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT s.id, s.title, s.session_date, s.start_time, s.qr_token
  FROM public.preteen_attendance_sessions s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE t.slug = _tenant_slug
    AND t.is_archived IS NOT TRUE
    AND s.status = 'open'
  ORDER BY s.session_date DESC, s.start_time NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.get_preteen_open_checkins(_qr_token uuid)
RETURNS TABLE(preteen_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_session_id uuid;
BEGIN
  SELECT id INTO v_session_id FROM public.preteen_attendance_sessions WHERE qr_token = _qr_token;
  IF v_session_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.preteen_id FROM public.preteen_attendance_records r
    WHERE r.session_id = v_session_id AND r.checked_out_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_consented_preteens_for_session(_qr_token uuid)
RETURNS TABLE(id uuid, first_name text, last_name text, has_self_pin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_tenant uuid; v_status text;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
    FROM public.preteen_attendance_sessions WHERE qr_token = _qr_token;
  IF v_tenant IS NULL OR v_status <> 'open' THEN RETURN; END IF;
  RETURN QUERY
    SELECT t.id, t.first_name, t.last_name, (t.self_pin_hash IS NOT NULL) AS has_self_pin
    FROM public.preteens t
    WHERE t.tenant_id = v_tenant AND t.is_active = true
      AND COALESCE(t.attendance_consent, false) = true
    ORDER BY t.first_name, t.last_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_checkin(_qr_token uuid, _preteen_id uuid, _pin text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE
  v_session public.preteen_attendance_sessions%ROWTYPE;
  v_teen public.preteens%ROWTYPE;
  v_record public.preteen_attendance_records%ROWTYPE;
  v_now timestamptz := now();
  v_status text;
  v_guardian_ok boolean := false;
  v_worker_ok boolean := false;
  v_pin_ok boolean := false;
  v_actor uuid := auth.uid();
  v_duration int;
  v_teen_name text;
  v_action text;
  v_notif_title text;
  v_notif_msg text;
BEGIN
  SELECT * INTO v_session FROM public.preteen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  IF v_session.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'session_closed'); END IF;

  SELECT * INTO v_teen FROM public.preteens WHERE id = _preteen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_preteen'); END IF;
  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = v_teen.primary_guardian_member_id AND m.user_id = v_actor
    ) INTO v_guardian_ok;
    v_worker_ok := public.is_admin(v_actor, v_session.tenant_id)
                   OR public.is_children_church_member(v_actor, v_session.tenant_id);
  END IF;

  IF v_teen.access_pin_hash IS NOT NULL AND _pin IS NOT NULL AND _pin <> '' THEN
    v_pin_ok := (v_teen.access_pin_hash = extensions.crypt(_pin, v_teen.access_pin_hash));
  END IF;

  IF NOT (v_guardian_ok OR v_worker_ok OR v_pin_ok) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorised');
  END IF;

  IF v_session.late_after IS NOT NULL AND (v_session.session_date + v_session.late_after) < v_now THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  v_teen_name := v_teen.first_name || ' ' || v_teen.last_name;

  SELECT * INTO v_record FROM public.preteen_attendance_records
    WHERE session_id = v_session.id AND preteen_id = v_teen.id;

  IF NOT FOUND THEN
    INSERT INTO public.preteen_attendance_records
      (tenant_id, session_id, preteen_id, status, checked_in_at, checked_in_by, source)
    VALUES
      (v_session.tenant_id, v_session.id, v_teen.id, v_status, v_now, v_actor,
       CASE WHEN v_worker_ok AND NOT v_guardian_ok AND NOT v_pin_ok THEN 'worker' ELSE 'qr' END)
    RETURNING * INTO v_record;
    v_action := 'checked_in';
    v_notif_title := v_teen_name || ' checked in at ' || v_session.title;
    v_notif_msg := 'Signed in at ' || to_char(v_now, 'HH24:MI')
                   || CASE WHEN v_status = 'late' THEN ' (late)' ELSE '' END;
  ELSIF v_record.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'action', 'already_checked_out',
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'duration_minutes', v_record.duration_minutes);
  ELSE
    v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_record.checked_in_at))::int / 60);
    UPDATE public.preteen_attendance_records
      SET checked_out_at = v_now, checked_out_by = v_actor,
          duration_minutes = v_duration, updated_at = now()
      WHERE id = v_record.id RETURNING * INTO v_record;
    v_action := 'checked_out';
    v_notif_title := v_teen_name || ' checked out of ' || v_session.title;
    v_notif_msg := 'Signed out at ' || to_char(v_now, 'HH24:MI') || ' · Duration: ' || v_duration || ' min';
  END IF;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'preteen_checkin', 'preteen_attendance', v_record.id::text
    FROM public.members m
    WHERE m.id = v_teen.primary_guardian_member_id
      AND m.user_id IS NOT NULL
      AND (v_actor IS NULL OR m.user_id <> v_actor);

  IF v_action = 'checked_in' THEN
    RETURN jsonb_build_object('ok', true, 'action', 'checked_in', 'status', v_record.status,
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'checked_in_at', v_record.checked_in_at);
  ELSE
    RETURN jsonb_build_object('ok', true, 'action', 'checked_out',
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'checked_in_at', v_record.checked_in_at,
      'checked_out_at', v_record.checked_out_at, 'duration_minutes', v_record.duration_minutes);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_request_enrolment(_qr_token uuid, _preteen_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_session public.preteen_attendance_sessions%ROWTYPE;
  v_teen public.preteens%ROWTYPE;
  v_enrol_id uuid;
  v_recent int;
BEGIN
  SELECT * INTO v_session FROM public.preteen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND OR v_session.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_teen FROM public.preteens
    WHERE id = _preteen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_preteen'); END IF;
  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
  END IF;
  SELECT COUNT(*) INTO v_recent FROM public.preteen_self_enrolments
    WHERE preteen_id = v_teen.id AND requested_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'rate_limited'); END IF;
  INSERT INTO public.preteen_self_enrolments (tenant_id, preteen_id, session_id, status)
    VALUES (v_teen.tenant_id, v_teen.id, v_session.id, 'pending')
    RETURNING id INTO v_enrol_id;
  RETURN jsonb_build_object('ok', true, 'enrolment_id', v_enrol_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_check_enrolment(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r public.preteen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.preteen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true,
    'status', CASE WHEN r.status = 'pending' AND r.expires_at < now() THEN 'expired' ELSE r.status END,
    'expires_at', r.expires_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_approve(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r public.preteen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.preteen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT (public.is_admin(auth.uid(), r.tenant_id) OR public.is_children_church_member(auth.uid(), r.tenant_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_pending'); END IF;
  IF r.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;
  UPDATE public.preteen_self_enrolments
    SET status = 'approved', approved_by = auth.uid(), approved_at = now(),
        expires_at = GREATEST(expires_at, now() + interval '10 minutes')
    WHERE id = _enrolment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_reject(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r public.preteen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.preteen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT (public.is_admin(auth.uid(), r.tenant_id) OR public.is_children_church_member(auth.uid(), r.tenant_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.preteen_self_enrolments
    SET status = 'rejected', approved_by = auth.uid(), approved_at = now()
    WHERE id = _enrolment_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_set_pin(_enrolment_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE r public.preteen_self_enrolments%ROWTYPE;
BEGIN
  IF _pin IS NULL OR length(_pin) < 4 OR length(_pin) > 6 OR _pin !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  SELECT * INTO r FROM public.preteen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status <> 'approved' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_approved'); END IF;
  IF r.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;
  UPDATE public.preteens
    SET self_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf')),
        self_pin_set_at = now(), updated_at = now()
    WHERE id = r.preteen_id;
  UPDATE public.preteen_self_enrolments SET status = 'used' WHERE id = _enrolment_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preteen_self_checkin(_qr_token uuid, _preteen_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE
  v_session public.preteen_attendance_sessions%ROWTYPE;
  v_teen public.preteens%ROWTYPE;
  v_record public.preteen_attendance_records%ROWTYPE;
  v_now timestamptz := now();
  v_status text;
  v_duration int;
  v_teen_name text;
  v_action text;
  v_notif_title text;
  v_notif_msg text;
BEGIN
  IF _pin IS NULL OR _pin = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin'); END IF;
  SELECT * INTO v_session FROM public.preteen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  IF v_session.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'session_closed'); END IF;

  SELECT * INTO v_teen FROM public.preteens
    WHERE id = _preteen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_preteen'); END IF;
  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
  END IF;
  IF v_teen.self_pin_hash IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_enrolled'); END IF;
  IF v_teen.self_pin_hash <> extensions.crypt(_pin, v_teen.self_pin_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_pin');
  END IF;

  IF v_session.late_after IS NOT NULL AND (v_session.session_date + v_session.late_after) < v_now THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  v_teen_name := v_teen.first_name || ' ' || v_teen.last_name;

  SELECT * INTO v_record FROM public.preteen_attendance_records
    WHERE session_id = v_session.id AND preteen_id = v_teen.id;

  IF NOT FOUND THEN
    INSERT INTO public.preteen_attendance_records
      (tenant_id, session_id, preteen_id, status, checked_in_at, checked_in_by, source)
    VALUES (v_session.tenant_id, v_session.id, v_teen.id, v_status, v_now, NULL, 'self')
    RETURNING * INTO v_record;
    v_action := 'checked_in';
    v_notif_title := v_teen_name || ' checked in at ' || v_session.title;
    v_notif_msg := 'Signed in (self) at ' || to_char(v_now, 'HH24:MI')
                   || CASE WHEN v_status = 'late' THEN ' (late)' ELSE '' END;
  ELSIF v_record.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'action', 'already_checked_out',
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'duration_minutes', v_record.duration_minutes);
  ELSE
    v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_record.checked_in_at))::int / 60);
    UPDATE public.preteen_attendance_records
      SET checked_out_at = v_now, duration_minutes = v_duration, updated_at = now()
      WHERE id = v_record.id RETURNING * INTO v_record;
    v_action := 'checked_out';
    v_notif_title := v_teen_name || ' checked out of ' || v_session.title;
    v_notif_msg := 'Signed out (self) at ' || to_char(v_now, 'HH24:MI') || ' · Duration: ' || v_duration || ' min';
  END IF;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'preteen_checkin', 'preteen_attendance', v_record.id::text
    FROM public.members m
    WHERE m.id = v_teen.primary_guardian_member_id AND m.user_id IS NOT NULL;

  IF v_action = 'checked_in' THEN
    RETURN jsonb_build_object('ok', true, 'action', 'checked_in', 'status', v_record.status,
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'checked_in_at', v_record.checked_in_at);
  ELSE
    RETURN jsonb_build_object('ok', true, 'action', 'checked_out',
      'preteen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'checked_in_at', v_record.checked_in_at,
      'checked_out_at', v_record.checked_out_at, 'duration_minutes', v_record.duration_minutes);
  END IF;
END;
$function$;
