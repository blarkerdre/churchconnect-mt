CREATE OR REPLACE FUNCTION public.teen_self_checkin(_qr_token uuid, _teen_id uuid, _pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  IF v_teen.self_pin_hash <> extensions.crypt(_pin, v_teen.self_pin_hash) THEN
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
      'checked_in_at', v_record.checked_in_at,
      'checked_out_at', v_record.checked_out_at,
      'duration_minutes', v_record.duration_minutes);
  END IF;
END;
$function$;