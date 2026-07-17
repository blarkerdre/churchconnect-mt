
CREATE OR REPLACE FUNCTION public.teen_checkin(_qr_token uuid, _teen_id uuid, _pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.teen_attendance_sessions%ROWTYPE;
  v_teen public.teens%ROWTYPE;
  v_record public.teen_attendance_records%ROWTYPE;
  v_now timestamptz := now();
  v_status text;
  v_authorised boolean := false;
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
  SELECT * INTO v_session FROM public.teen_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_session.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_closed');
  END IF;

  SELECT * INTO v_teen FROM public.teens WHERE id = _teen_id AND tenant_id = v_session.tenant_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teen');
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = v_teen.primary_guardian_member_id AND m.user_id = v_actor
    ) INTO v_guardian_ok;

    IF NOT v_guardian_ok THEN
      SELECT EXISTS (
        SELECT 1 FROM public.child_guardians cg
        JOIN public.members m ON m.id = cg.member_id
        WHERE cg.tenant_id = v_teen.tenant_id
          AND m.user_id = v_actor
          AND cg.child_id = v_teen.id
      ) INTO v_guardian_ok;
    END IF;

    v_worker_ok := public.is_admin(v_actor, v_session.tenant_id)
                   OR public.is_teens_unit_member(v_actor, v_session.tenant_id);
  END IF;

  IF v_teen.access_pin_hash IS NOT NULL AND _pin IS NOT NULL AND _pin <> '' THEN
    v_pin_ok := (v_teen.access_pin_hash = crypt(_pin, v_teen.access_pin_hash));
  END IF;

  v_authorised := v_guardian_ok OR v_worker_ok OR v_pin_ok;
  IF NOT v_authorised THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorised');
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
      (v_session.tenant_id, v_session.id, v_teen.id, v_status, v_now, v_actor,
       CASE WHEN v_worker_ok AND NOT v_guardian_ok AND NOT v_pin_ok THEN 'worker' ELSE 'qr' END)
    RETURNING * INTO v_record;

    v_action := 'checked_in';
    v_notif_title := v_teen_name || ' checked in at ' || v_session.title;
    v_notif_msg := 'Signed in at ' || to_char(v_now, 'HH24:MI')
                   || CASE WHEN v_status = 'late' THEN ' (late)' ELSE '' END;
  ELSIF v_record.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'already_checked_out',
      'teen_name', v_teen_name,
      'session_title', v_session.title,
      'session_date', v_session.session_date,
      'duration_minutes', v_record.duration_minutes
    );
  ELSE
    v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_record.checked_in_at))::int / 60);
    UPDATE public.teen_attendance_records
      SET checked_out_at = v_now,
          checked_out_by = v_actor,
          duration_minutes = v_duration,
          updated_at = now()
      WHERE id = v_record.id
      RETURNING * INTO v_record;

    v_action := 'checked_out';
    v_notif_title := v_teen_name || ' checked out of ' || v_session.title;
    v_notif_msg := 'Signed out at ' || to_char(v_now, 'HH24:MI')
                   || ' · Duration: ' || v_duration || ' min';
  END IF;

  -- Notify guardians (skip self-actor to avoid self-notify)
  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'teen_checkin', 'teen_attendance', v_record.id::text
    FROM public.members m
    WHERE m.id = v_teen.primary_guardian_member_id
      AND m.user_id IS NOT NULL
      AND (v_actor IS NULL OR m.user_id <> v_actor)
  UNION
  SELECT DISTINCT m.user_id, v_teen.tenant_id, v_notif_title, v_notif_msg,
                  'teen_checkin', 'teen_attendance', v_record.id::text
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = v_teen.id
      AND cg.tenant_id = v_teen.tenant_id
      AND m.user_id IS NOT NULL
      AND (v_actor IS NULL OR m.user_id <> v_actor);

  IF v_action = 'checked_in' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'checked_in',
      'status', v_record.status,
      'teen_name', v_teen_name,
      'session_title', v_session.title,
      'session_date', v_session.session_date,
      'checked_in_at', v_record.checked_in_at
    );
  ELSE
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'checked_out',
      'teen_name', v_teen_name,
      'session_title', v_session.title,
      'session_date', v_session.session_date,
      'checked_in_at', v_record.checked_in_at,
      'checked_out_at', v_record.checked_out_at,
      'duration_minutes', v_record.duration_minutes
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.teen_checkin(uuid, uuid, text) TO authenticated, anon;
