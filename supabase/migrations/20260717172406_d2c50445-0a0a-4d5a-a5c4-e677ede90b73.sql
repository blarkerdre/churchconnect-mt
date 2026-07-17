
-- 1. Columns on teens for the self-PIN
ALTER TABLE public.teens
  ADD COLUMN IF NOT EXISTS self_pin_hash text,
  ADD COLUMN IF NOT EXISTS self_pin_set_at timestamptz;

-- 2. New table
CREATE TABLE IF NOT EXISTS public.teen_self_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  teen_id uuid NOT NULL REFERENCES public.teens(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.teen_attendance_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  failed_attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.teen_self_enrolments TO authenticated;
GRANT ALL ON public.teen_self_enrolments TO service_role;

ALTER TABLE public.teen_self_enrolments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teen_self_enrolments_worker_select" ON public.teen_self_enrolments
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  );

CREATE POLICY "teen_self_enrolments_worker_update" ON public.teen_self_enrolments
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  );

CREATE INDEX IF NOT EXISTS idx_tse_tenant_status ON public.teen_self_enrolments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tse_teen ON public.teen_self_enrolments(teen_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tse_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_tse_touch_updated_at ON public.teen_self_enrolments;
CREATE TRIGGER trg_tse_touch_updated_at
  BEFORE UPDATE ON public.teen_self_enrolments
  FOR EACH ROW EXECUTE FUNCTION public.tse_touch_updated_at();

-- 3. Lightweight teen picker for the check-in page (anon-safe)
CREATE OR REPLACE FUNCTION public.list_consented_teens_for_session(_qr_token uuid)
RETURNS TABLE(id uuid, first_name text, last_name text, has_self_pin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_status text;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
    FROM public.teen_attendance_sessions WHERE qr_token = _qr_token;
  IF v_tenant IS NULL OR v_status <> 'open' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT t.id, t.first_name, t.last_name, (t.self_pin_hash IS NOT NULL) AS has_self_pin
    FROM public.teens t
    WHERE t.tenant_id = v_tenant
      AND t.is_active = true
      AND COALESCE(t.attendance_consent, false) = true
    ORDER BY t.first_name, t.last_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_consented_teens_for_session(uuid) TO anon, authenticated;

-- 4. Request self-enrolment (anon-callable)
CREATE OR REPLACE FUNCTION public.teen_self_request_enrolment(_qr_token uuid, _teen_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.teen_attendance_sessions%ROWTYPE;
  v_teen public.teens%ROWTYPE;
  v_enrol_id uuid;
  v_recent int;
BEGIN
  SELECT * INTO v_session FROM public.teen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND OR v_session.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_teen FROM public.teens
    WHERE id = _teen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teen');
  END IF;
  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
  END IF;

  -- Rate limit: max 3 pending per teen per hour
  SELECT COUNT(*) INTO v_recent FROM public.teen_self_enrolments
    WHERE teen_id = v_teen.id AND requested_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.teen_self_enrolments (tenant_id, teen_id, session_id, status)
    VALUES (v_teen.tenant_id, v_teen.id, v_session.id, 'pending')
    RETURNING id INTO v_enrol_id;

  RETURN jsonb_build_object('ok', true, 'enrolment_id', v_enrol_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_request_enrolment(uuid, uuid) TO anon, authenticated;

-- 5. Poll enrolment status
CREATE OR REPLACE FUNCTION public.teen_self_check_enrolment(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.teen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.teen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN r.status = 'pending' AND r.expires_at < now() THEN 'expired' ELSE r.status END,
    'expires_at', r.expires_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_check_enrolment(uuid) TO anon, authenticated;

-- 6. Worker approve / reject
CREATE OR REPLACE FUNCTION public.teen_self_approve(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.teen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.teen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT (public.is_admin(auth.uid(), r.tenant_id) OR public.is_teens_unit_member(auth.uid(), r.tenant_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;
  IF r.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  UPDATE public.teen_self_enrolments
    SET status = 'approved', approved_by = auth.uid(), approved_at = now(),
        expires_at = GREATEST(expires_at, now() + interval '10 minutes')
    WHERE id = _enrolment_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_approve(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.teen_self_reject(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.teen_self_enrolments%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.teen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT (public.is_admin(auth.uid(), r.tenant_id) OR public.is_teens_unit_member(auth.uid(), r.tenant_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.teen_self_enrolments
    SET status = 'rejected', approved_by = auth.uid(), approved_at = now()
    WHERE id = _enrolment_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_reject(uuid) TO authenticated;

-- 7. Teen sets their PIN after approval
CREATE OR REPLACE FUNCTION public.teen_self_set_pin(_enrolment_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.teen_self_enrolments%ROWTYPE;
BEGIN
  IF _pin IS NULL OR length(_pin) < 4 OR length(_pin) > 6 OR _pin !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  SELECT * INTO r FROM public.teen_self_enrolments WHERE id = _enrolment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status <> 'approved' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_approved'); END IF;
  IF r.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'expired'); END IF;

  UPDATE public.teens
    SET self_pin_hash = crypt(_pin, gen_salt('bf')),
        self_pin_set_at = now(),
        updated_at = now()
    WHERE id = r.teen_id;

  UPDATE public.teen_self_enrolments SET status = 'used' WHERE id = _enrolment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_set_pin(uuid, text) TO anon, authenticated;

-- 8. Self check-in using self-PIN (delegates through teen_checkin by matching self_pin_hash first)
CREATE OR REPLACE FUNCTION public.teen_self_checkin(_qr_token uuid, _teen_id uuid, _pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.teen_attendance_sessions%ROWTYPE;
  v_teen public.teens%ROWTYPE;
  v_record public.teen_attendance_records%ROWTYPE;
  v_now timestamptz := now();
  v_status text;
  v_duration int;
  v_teen_name text;
  v_action text;
  v_notif_title text;
  v_notif_msg text;
BEGIN
  IF _pin IS NULL OR _pin = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  SELECT * INTO v_session FROM public.teen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  IF v_session.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'session_closed'); END IF;

  SELECT * INTO v_teen FROM public.teens
    WHERE id = _teen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_teen'); END IF;
  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
  END IF;
  IF v_teen.self_pin_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_enrolled');
  END IF;
  IF v_teen.self_pin_hash <> crypt(_pin, v_teen.self_pin_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_pin');
  END IF;

  IF v_session.late_after IS NOT NULL
     AND (v_session.session_date + v_session.late_after) < v_now THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  v_teen_name := v_teen.first_name || ' ' || v_teen.last_name;

  SELECT * INTO v_record FROM public.teen_attendance_records
    WHERE session_id = v_session.id AND teen_id = v_teen.id;

  IF NOT FOUND THEN
    INSERT INTO public.teen_attendance_records
      (tenant_id, session_id, teen_id, status, checked_in_at, checked_in_by, source)
    VALUES
      (v_session.tenant_id, v_session.id, v_teen.id, v_status, v_now, NULL, 'self')
    RETURNING * INTO v_record;
    v_action := 'checked_in';
    v_notif_title := v_teen_name || ' checked in at ' || v_session.title;
    v_notif_msg := 'Signed in (self) at ' || to_char(v_now, 'HH24:MI')
                   || CASE WHEN v_status = 'late' THEN ' (late)' ELSE '' END;
  ELSIF v_record.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'action', 'already_checked_out',
      'teen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date,
      'duration_minutes', v_record.duration_minutes
    );
  ELSE
    v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_record.checked_in_at))::int / 60);
    UPDATE public.teen_attendance_records
      SET checked_out_at = v_now, duration_minutes = v_duration, updated_at = now()
      WHERE id = v_record.id RETURNING * INTO v_record;
    v_action := 'checked_out';
    v_notif_title := v_teen_name || ' checked out of ' || v_session.title;
    v_notif_msg := 'Signed out (self) at ' || to_char(v_now, 'HH24:MI')
                   || ' · Duration: ' || v_duration || ' min';
  END IF;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'teen_checkin', 'teen_attendance', v_record.id::text
    FROM public.members m
    WHERE m.id = v_teen.primary_guardian_member_id AND m.user_id IS NOT NULL
  UNION
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'teen_checkin', 'teen_attendance', v_record.id::text
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = v_teen.id AND cg.tenant_id = v_teen.tenant_id AND m.user_id IS NOT NULL;

  IF v_action = 'checked_in' THEN
    RETURN jsonb_build_object('ok', true, 'action', 'checked_in', 'status', v_record.status,
      'teen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date, 'checked_in_at', v_record.checked_in_at);
  ELSE
    RETURN jsonb_build_object('ok', true, 'action', 'checked_out',
      'teen_name', v_teen_name, 'session_title', v_session.title,
      'session_date', v_session.session_date,
      'checked_in_at', v_record.checked_in_at, 'checked_out_at', v_record.checked_out_at,
      'duration_minutes', v_record.duration_minutes);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.teen_self_checkin(uuid, uuid, text) TO anon, authenticated;
