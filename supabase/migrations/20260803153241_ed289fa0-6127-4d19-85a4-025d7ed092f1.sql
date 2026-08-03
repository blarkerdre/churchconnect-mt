CREATE OR REPLACE FUNCTION public.log_wofbi_activity(
  _tenant_id uuid,
  _action text,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _title text DEFAULT NULL,
  _message text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF _tenant_id IS NULL OR NOT public.user_has_tenant_access(_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_tenant_access');
  END IF;
  -- Only allow the Bible School activity vocabulary through this helper.
  IF _entity_type NOT IN (
    'wofbi_feedback_responses','lecturer_ratings','exam_attempts',
    'lecturer_qc_checks','wofbi_attendance_records'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unsupported_entity');
  END IF;

  IF _title IS NOT NULL AND _title <> '' THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
    VALUES (v_uid, _tenant_id, _title, _message, 'bible_school', _entity_type, _entity_id);
  END IF;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (v_uid, _tenant_id, _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb));

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_wofbi_activity(uuid, text, text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.wofbi_checkin(_qr_token uuid, _confirm_checkout boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_session public.wofbi_attendance_sessions%ROWTYPE;
  v_member_id uuid;
  v_reg public.course_registrations%ROWTYPE;
  v_existing public.wofbi_attendance_records%ROWTYPE;
  v_status text;
  v_now timestamptz := now();
  v_duration int;
  v_is_open boolean;
  v_course_name text;
  v_record_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM public.wofbi_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_is_open := (v_session.scheduled_close_at IS NULL OR v_session.scheduled_close_at > v_now)
    AND (
      v_session.status = 'open'
      OR (v_session.scheduled_open_at IS NOT NULL AND v_session.scheduled_open_at <= v_now)
    );

  IF NOT v_is_open THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_closed');
  END IF;

  SELECT id INTO v_member_id FROM public.members
    WHERE user_id = v_uid AND tenant_id = v_session.tenant_id
    LIMIT 1;

  IF v_member_id IS NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email IS NOT NULL AND v_email <> '' THEN
      SELECT id INTO v_member_id FROM public.members
        WHERE tenant_id = v_session.tenant_id
          AND lower(email) = v_email
          AND user_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1;
      IF v_member_id IS NOT NULL THEN
        UPDATE public.members SET user_id = v_uid WHERE id = v_member_id AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  SELECT * INTO v_reg FROM public.course_registrations
    WHERE course_id = v_session.course_id
      AND member_id = v_member_id
      AND tenant_id = v_session.tenant_id
      AND status IN ('approved','enrolled','active','completed')
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_on_roster');
  END IF;

  SELECT name INTO v_course_name FROM public.exam_titles WHERE id = v_session.course_id;

  SELECT * INTO v_existing FROM public.wofbi_attendance_records
    WHERE session_id = v_session.id AND registration_id = v_reg.id;

  IF FOUND THEN
    IF v_existing.checked_out_at IS NULL THEN
      IF NOT COALESCE(_confirm_checkout, false) THEN
        RETURN jsonb_build_object(
          'ok', true, 'action', 'confirm_checkout',
          'status', v_existing.status,
          'checked_in_at', v_existing.checked_in_at,
          'elapsed_minutes', GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_existing.checked_in_at))::int / 60),
          'session_title', v_session.title,
          'session_date', v_session.session_date
        );
      END IF;

      v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_existing.checked_in_at))::int / 60);
      UPDATE public.wofbi_attendance_records
        SET checked_out_at = v_now, duration_minutes = v_duration
        WHERE id = v_existing.id;

      INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
      VALUES (
        v_uid, v_session.tenant_id,
        'Checked out — ' || COALESCE(v_course_name, 'Bible School'),
        COALESCE(v_session.title, 'Attendance') || ' · ' || v_duration || ' min on site',
        'bible_school', 'wofbi_attendance_records', v_existing.id::text
      );

      INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
      VALUES (
        v_uid, v_session.tenant_id, 'wofbi_checked_out', 'wofbi_attendance_records', v_existing.id::text,
        jsonb_build_object(
          'course', v_course_name, 'session', v_session.title,
          'session_date', v_session.session_date, 'duration_minutes', v_duration, 'source', 'qr'
        )
      );

      RETURN jsonb_build_object(
        'ok', true, 'action', 'checked_out',
        'status', v_existing.status,
        'duration_minutes', v_duration,
        'session_title', v_session.title,
        'session_date', v_session.session_date
      );
    ELSE
      RETURN jsonb_build_object(
        'ok', true, 'action', 'already_checked_out',
        'status', v_existing.status,
        'duration_minutes', v_existing.duration_minutes,
        'session_title', v_session.title,
        'session_date', v_session.session_date
      );
    END IF;
  END IF;

  IF v_session.late_after IS NOT NULL AND v_now::time > v_session.late_after THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.wofbi_attendance_records
    (tenant_id, session_id, registration_id, member_id, status, checked_in_at, source)
  VALUES
    (v_session.tenant_id, v_session.id, v_reg.id, v_member_id, v_status, v_now, 'qr')
  RETURNING id INTO v_record_id;

  INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_type, reference_id)
  VALUES (
    v_uid, v_session.tenant_id,
    'Checked in — ' || COALESCE(v_course_name, 'Bible School'),
    COALESCE(v_session.title, 'Attendance') || ' · marked ' || v_status,
    'bible_school', 'wofbi_attendance_records', v_record_id::text
  );

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid, v_session.tenant_id, 'wofbi_checked_in', 'wofbi_attendance_records', v_record_id::text,
    jsonb_build_object(
      'course', v_course_name, 'session', v_session.title,
      'session_date', v_session.session_date, 'status', v_status, 'source', 'qr'
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'action', 'checked_in',
    'status', v_status,
    'session_title', v_session.title,
    'session_date', v_session.session_date
  );
END;
$function$;