
CREATE TABLE public.wofbi_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.exam_titles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  session_date date NOT NULL,
  late_after time,
  status text NOT NULL DEFAULT 'open',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_attendance_sessions TO authenticated;
GRANT ALL ON public.wofbi_attendance_sessions TO service_role;

ALTER TABLE public.wofbi_attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wofbi_att_sessions_tenant_read" ON public.wofbi_attendance_sessions
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "wofbi_att_sessions_admin_write" ON public.wofbi_attendance_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

CREATE TABLE public.wofbi_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.wofbi_attendance_sessions(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.course_registrations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'present',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'qr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, registration_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wofbi_attendance_records TO authenticated;
GRANT ALL ON public.wofbi_attendance_records TO service_role;

ALTER TABLE public.wofbi_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wofbi_att_records_tenant_read" ON public.wofbi_attendance_records
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "wofbi_att_records_admin_write" ON public.wofbi_attendance_records
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

CREATE TRIGGER wofbi_att_sessions_updated_at
  BEFORE UPDATE ON public.wofbi_attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER wofbi_att_records_updated_at
  BEFORE UPDATE ON public.wofbi_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.wofbi_checkin(_qr_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.wofbi_attendance_sessions;
  v_reg public.course_registrations;
  v_member_id uuid;
  v_status text;
  v_now timestamptz := now();
  v_record public.wofbi_attendance_records;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_session FROM public.wofbi_attendance_sessions WHERE qr_token = _qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF v_session.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_closed');
  END IF;

  SELECT id INTO v_member_id FROM public.members
    WHERE user_id = auth.uid() AND tenant_id = v_session.tenant_id
    LIMIT 1;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  SELECT * INTO v_reg FROM public.course_registrations
    WHERE tenant_id = v_session.tenant_id
      AND course_id = v_session.course_id
      AND member_id = v_member_id
      AND status IN ('approved', 'enrolled', 'active', 'completed')
    ORDER BY registered_at DESC
    LIMIT 1;
  IF v_reg.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_on_roster');
  END IF;

  IF v_session.late_after IS NOT NULL
     AND (v_session.session_date + v_session.late_after) < v_now THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.wofbi_attendance_records
    (tenant_id, session_id, registration_id, member_id, status, checked_in_at, source)
  VALUES
    (v_session.tenant_id, v_session.id, v_reg.id, v_member_id, v_status, v_now, 'qr')
  ON CONFLICT (session_id, registration_id) DO UPDATE
    SET status = EXCLUDED.status,
        checked_in_at = EXCLUDED.checked_in_at,
        updated_at = now()
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_record.status,
    'session_title', v_session.title,
    'session_date', v_session.session_date,
    'checked_in_at', v_record.checked_in_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wofbi_checkin(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.wofbi_attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wofbi_attendance_sessions;
