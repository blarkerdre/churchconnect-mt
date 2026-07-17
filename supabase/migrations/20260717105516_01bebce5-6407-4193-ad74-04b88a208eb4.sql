
-- 1. Consent fields on teens
ALTER TABLE public.teens
  ADD COLUMN IF NOT EXISTS attendance_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_consent_by uuid;

-- 2. Session type
ALTER TABLE public.teen_attendance_sessions
  ADD COLUMN IF NOT EXISTS session_type text;

-- 3. Role helpers
CREATE OR REPLACE FUNCTION public.is_teens_unit_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teens_unit_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_teens_unit_leader(_user_id, _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = _user_id
        AND m.tenant_id = _tenant_id
        AND m.church_unit IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(string_to_array(m.church_unit, ',')) AS u(name)
          WHERE lower(btrim(u.name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry')
        )
    );
$$;

-- 4. Session policies: split write into insert / update / delete
DROP POLICY IF EXISTS "teen_sessions_write" ON public.teen_attendance_sessions;
DROP POLICY IF EXISTS "teen_sessions_insert" ON public.teen_attendance_sessions;
DROP POLICY IF EXISTS "teen_sessions_update" ON public.teen_attendance_sessions;
DROP POLICY IF EXISTS "teen_sessions_delete" ON public.teen_attendance_sessions;

CREATE POLICY "teen_sessions_insert" ON public.teen_attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  );

CREATE POLICY "teen_sessions_update" ON public.teen_attendance_sessions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
  );

CREATE POLICY "teen_sessions_delete" ON public.teen_attendance_sessions
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_leader(auth.uid(), tenant_id)
  );

-- 5. Trigger: restrict non-leader/non-admin updates to status only
CREATE OR REPLACE FUNCTION public.restrict_teen_session_updates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid(), NEW.tenant_id)
     OR public.is_teens_unit_leader(auth.uid(), NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  -- Non-leader members: only allow status changes
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
    RAISE EXCEPTION 'Only Teens unit leaders or admins can edit session details';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_teen_session_updates ON public.teen_attendance_sessions;
CREATE TRIGGER trg_restrict_teen_session_updates
  BEFORE UPDATE ON public.teen_attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.restrict_teen_session_updates();

-- 6. Update teen_checkin to enforce consent
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

  IF NOT COALESCE(v_teen.attendance_consent, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_consent');
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
