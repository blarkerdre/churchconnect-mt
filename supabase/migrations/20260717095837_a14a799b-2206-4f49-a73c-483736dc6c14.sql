
-- ============ Helper: is a user a leader of a "Teens" unit? ============
CREATE OR REPLACE FUNCTION public.is_teens_unit_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('teens','teen','teenagers','youth','teens ministry','teen ministry')
  );
$$;

-- ============ teens ============
CREATE TABLE public.teens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  primary_guardian_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IS NULL OR gender IN ('Male','Female')),
  photo_url text,
  access_pin_hash text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teens_tenant ON public.teens(tenant_id);
CREATE INDEX idx_teens_guardian ON public.teens(primary_guardian_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teens TO authenticated;
GRANT ALL ON public.teens TO service_role;

ALTER TABLE public.teens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teens_read"
ON public.teens FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = teens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.is_teens_unit_member(auth.uid(), tenant_id)
);

CREATE POLICY "teens_insert"
ON public.teens FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = teens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY "teens_update"
ON public.teens FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = teens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.is_teens_unit_member(auth.uid(), tenant_id)
)
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "teens_delete"
ON public.teens FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = teens.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE TRIGGER trg_teens_updated
  BEFORE UPDATE ON public.teens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ teen_attendance_sessions ============
CREATE TABLE public.teen_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  session_date date NOT NULL,
  start_time time,
  end_time time,
  late_after time,
  status text NOT NULL DEFAULT 'open',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teen_sessions_tenant ON public.teen_attendance_sessions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teen_attendance_sessions TO authenticated;
GRANT ALL ON public.teen_attendance_sessions TO service_role;
ALTER TABLE public.teen_attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teen_sessions_read" ON public.teen_attendance_sessions
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "teen_sessions_write" ON public.teen_attendance_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id) OR public.is_teens_unit_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_teens_unit_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_teen_sessions_updated
  BEFORE UPDATE ON public.teen_attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ teen_attendance_records ============
CREATE TABLE public.teen_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.teen_attendance_sessions(id) ON DELETE CASCADE,
  teen_id uuid NOT NULL REFERENCES public.teens(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by uuid,
  checked_out_at timestamptz,
  checked_out_by uuid,
  duration_minutes int,
  source text NOT NULL DEFAULT 'qr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, teen_id)
);
CREATE INDEX idx_teen_records_tenant ON public.teen_attendance_records(tenant_id);
CREATE INDEX idx_teen_records_session ON public.teen_attendance_records(session_id);
CREATE INDEX idx_teen_records_teen ON public.teen_attendance_records(teen_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teen_attendance_records TO authenticated;
GRANT ALL ON public.teen_attendance_records TO service_role;
ALTER TABLE public.teen_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teen_records_read" ON public.teen_attendance_records
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_teens_unit_member(auth.uid(), tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.teens t
      JOIN public.members m ON m.id = t.primary_guardian_member_id
      WHERE t.id = teen_attendance_records.teen_id
        AND m.user_id = auth.uid()
        AND t.tenant_id = teen_attendance_records.tenant_id
    )
  );

CREATE POLICY "teen_records_write" ON public.teen_attendance_records
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id) OR public.is_teens_unit_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id) OR public.is_teens_unit_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_teen_records_updated
  BEFORE UPDATE ON public.teen_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RPC: teen_checkin ============
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

  -- Authorisation checks
  IF v_actor IS NOT NULL THEN
    -- Guardian?
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

    -- Admin / teens unit worker?
    v_worker_ok := public.is_admin(v_actor, v_session.tenant_id)
                   OR public.is_teens_unit_member(v_actor, v_session.tenant_id);
  END IF;

  -- PIN fallback (anonymous or extra-verification)
  IF v_teen.access_pin_hash IS NOT NULL AND _pin IS NOT NULL AND _pin <> '' THEN
    v_pin_ok := (v_teen.access_pin_hash = crypt(_pin, v_teen.access_pin_hash));
  END IF;

  v_authorised := v_guardian_ok OR v_worker_ok OR v_pin_ok;
  IF NOT v_authorised THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorised');
  END IF;

  -- Determine late status
  IF v_session.late_after IS NOT NULL
     AND (v_session.session_date + v_session.late_after) < v_now THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  -- Existing record?
  SELECT * INTO v_record FROM public.teen_attendance_records
    WHERE session_id = v_session.id AND teen_id = v_teen.id;

  IF NOT FOUND THEN
    INSERT INTO public.teen_attendance_records
      (tenant_id, session_id, teen_id, status, checked_in_at, checked_in_by, source)
    VALUES
      (v_session.tenant_id, v_session.id, v_teen.id, v_status, v_now, v_actor,
       CASE WHEN v_worker_ok AND NOT v_guardian_ok AND NOT v_pin_ok THEN 'worker' ELSE 'qr' END)
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'checked_in',
      'status', v_record.status,
      'teen_name', v_teen.first_name || ' ' || v_teen.last_name,
      'session_title', v_session.title,
      'session_date', v_session.session_date,
      'checked_in_at', v_record.checked_in_at
    );
  END IF;

  -- Already checked in — record check-out on second scan
  IF v_record.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'already_checked_out',
      'teen_name', v_teen.first_name || ' ' || v_teen.last_name,
      'session_title', v_session.title,
      'session_date', v_session.session_date,
      'duration_minutes', v_record.duration_minutes
    );
  END IF;

  v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_record.checked_in_at))::int / 60);

  UPDATE public.teen_attendance_records
    SET checked_out_at = v_now,
        checked_out_by = v_actor,
        duration_minutes = v_duration,
        updated_at = now()
    WHERE id = v_record.id
    RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'checked_out',
    'teen_name', v_teen.first_name || ' ' || v_teen.last_name,
    'session_title', v_session.title,
    'session_date', v_session.session_date,
    'checked_in_at', v_record.checked_in_at,
    'checked_out_at', v_record.checked_out_at,
    'duration_minutes', v_record.duration_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teen_checkin(uuid, uuid, text) TO authenticated, anon;

-- Realtime for live counts
ALTER PUBLICATION supabase_realtime ADD TABLE public.teen_attendance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teen_attendance_records;

-- Ensure pgcrypto is available for PIN hashing (crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
