
-- 1) Trigger: ensure member + course registration exist when an application is approved
CREATE OR REPLACE FUNCTION public.ensure_member_for_wofbi_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_email text;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Skip if already linked to a valid member in the same tenant
  IF NEW.member_id IS NOT NULL THEN
    PERFORM 1 FROM public.members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id;
    IF FOUND THEN
      v_member_id := NEW.member_id;
    END IF;
  END IF;

  v_email := lower(trim(coalesce(NEW.email, '')));

  IF v_member_id IS NULL AND v_email <> '' THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE tenant_id = NEW.tenant_id AND lower(email) = v_email
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL THEN
    INSERT INTO public.members (
      tenant_id, first_name, last_name, email, phone,
      membership_status, gdpr_consent, gdpr_consent_date
    ) VALUES (
      NEW.tenant_id,
      coalesce(NEW.first_name, 'Bible'),
      coalesce(NEW.last_name, 'School Student'),
      NULLIF(v_email, ''),
      NEW.phone,
      'Bible School',
      true,
      now()
    )
    RETURNING id INTO v_member_id;
  END IF;

  IF NEW.member_id IS DISTINCT FROM v_member_id THEN
    NEW.member_id := v_member_id;
  END IF;

  -- Ensure a course_registrations row exists
  IF NEW.course_id IS NOT NULL THEN
    INSERT INTO public.course_registrations (
      tenant_id, member_id, course_id, status, registered_at, approved_at, registration_origin
    )
    SELECT NEW.tenant_id, v_member_id, NEW.course_id, 'approved', now(), now(),
           coalesce(NEW.registration_origin, 'public_qr')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.course_registrations
      WHERE tenant_id = NEW.tenant_id AND member_id = v_member_id AND course_id = NEW.course_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_member_for_wofbi_app_ins ON public.wofbi_applications;
DROP TRIGGER IF EXISTS trg_ensure_member_for_wofbi_app_upd ON public.wofbi_applications;

CREATE TRIGGER trg_ensure_member_for_wofbi_app_ins
BEFORE INSERT ON public.wofbi_applications
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION public.ensure_member_for_wofbi_application();

CREATE TRIGGER trg_ensure_member_for_wofbi_app_upd
BEFORE UPDATE OF status ON public.wofbi_applications
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
EXECUTE FUNCTION public.ensure_member_for_wofbi_application();

-- 2) Update wofbi_checkin to fall back to email match, backfilling members.user_id
CREATE OR REPLACE FUNCTION public.wofbi_checkin(_qr_token uuid)
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM public.wofbi_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_session.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_closed');
  END IF;

  -- Primary: match by user_id in tenant
  SELECT id INTO v_member_id FROM public.members
    WHERE user_id = v_uid AND tenant_id = v_session.tenant_id
    LIMIT 1;

  -- Fallback: match by email (auth user's email) in tenant, then backfill user_id
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

  SELECT * INTO v_existing FROM public.wofbi_attendance_records
    WHERE session_id = v_session.id AND registration_id = v_reg.id;

  IF FOUND THEN
    IF v_existing.checked_out_at IS NULL THEN
      v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_existing.checked_in_at))::int / 60);
      UPDATE public.wofbi_attendance_records
        SET checked_out_at = v_now, duration_minutes = v_duration
        WHERE id = v_existing.id;
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
    (v_session.tenant_id, v_session.id, v_reg.id, v_member_id, v_status, v_now, 'qr');

  RETURN jsonb_build_object(
    'ok', true, 'action', 'checked_in',
    'status', v_status,
    'session_title', v_session.title,
    'session_date', v_session.session_date
  );
END;
$function$;

-- 3) Backfill: for already-approved applications missing a member link, create/link members and registrations
DO $$
DECLARE r record; v_member_id uuid; v_email text;
BEGIN
  FOR r IN
    SELECT * FROM public.wofbi_applications
    WHERE status = 'approved'
  LOOP
    v_member_id := NULL;
    IF r.member_id IS NOT NULL THEN
      PERFORM 1 FROM public.members WHERE id = r.member_id AND tenant_id = r.tenant_id;
      IF FOUND THEN v_member_id := r.member_id; END IF;
    END IF;

    v_email := lower(trim(coalesce(r.email,'')));

    IF v_member_id IS NULL AND v_email <> '' THEN
      SELECT id INTO v_member_id FROM public.members
        WHERE tenant_id = r.tenant_id AND lower(email) = v_email
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF v_member_id IS NULL THEN
      INSERT INTO public.members (tenant_id, first_name, last_name, email, phone, membership_status, gdpr_consent, gdpr_consent_date)
      VALUES (r.tenant_id, coalesce(r.first_name,'Bible'), coalesce(r.last_name,'School Student'), NULLIF(v_email,''), r.phone, 'Bible School', true, now())
      RETURNING id INTO v_member_id;
    END IF;

    IF r.member_id IS DISTINCT FROM v_member_id THEN
      UPDATE public.wofbi_applications SET member_id = v_member_id WHERE id = r.id;
    END IF;

    IF r.course_id IS NOT NULL THEN
      INSERT INTO public.course_registrations (tenant_id, member_id, course_id, status, registered_at, approved_at, registration_origin)
      SELECT r.tenant_id, v_member_id, r.course_id, 'approved', now(), now(), coalesce(r.registration_origin,'public_qr')
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_registrations
        WHERE tenant_id = r.tenant_id AND member_id = v_member_id AND course_id = r.course_id
      );
    END IF;
  END LOOP;
END $$;
