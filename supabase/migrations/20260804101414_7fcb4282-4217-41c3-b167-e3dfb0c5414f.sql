CREATE OR REPLACE FUNCTION public.audit_attendance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module      text := TG_ARGV[0];
  v_kind        text := TG_ARGV[1];            -- 'record' | 'session'
  v_session_tbl text := NULLIF(TG_ARGV[2], '');
  v_row         jsonb;
  v_before      jsonb;
  v_after       jsonb;
  v_tenant      uuid;
  v_entity_id   text;
  v_action      text;
  v_member_name text;
  v_session_ttl text;
  v_skip        text[] := ARRAY['id','tenant_id','created_at','updated_at','qr_token'];
  k             text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_tenant := NULLIF(v_row->>'tenant_id','')::uuid;
  v_entity_id := v_row->>'id';

  IF TG_OP <> 'INSERT' THEN
    v_before := to_jsonb(OLD);
    FOREACH k IN ARRAY v_skip LOOP v_before := v_before - k; END LOOP;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_after := to_jsonb(NEW);
    FOREACH k IN ARRAY v_skip LOOP v_after := v_after - k; END LOOP;
  END IF;

  IF TG_OP = 'UPDATE' AND v_before = v_after THEN
    RETURN NULL;
  END IF;

  v_action := 'attendance_' || v_kind || '_' || lower(
    CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END);

  -- Person affected
  BEGIN
    IF v_row ? 'member_id' AND v_row->>'member_id' IS NOT NULL THEN
      SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
        INTO v_member_name FROM public.members WHERE id = (v_row->>'member_id')::uuid;
    ELSIF v_row ? 'teen_id' AND v_row->>'teen_id' IS NOT NULL THEN
      SELECT name INTO v_member_name FROM public.teens WHERE id = (v_row->>'teen_id')::uuid;
    ELSIF v_row ? 'preteen_id' AND v_row->>'preteen_id' IS NOT NULL THEN
      SELECT name INTO v_member_name FROM public.preteens WHERE id = (v_row->>'preteen_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_member_name := NULL;
  END;

  -- Session context
  IF v_kind = 'session' THEN
    v_session_ttl := coalesce(v_row->>'title', v_row->>'session_type');
  ELSIF v_session_tbl IS NOT NULL AND v_row ? 'session_id' AND v_row->>'session_id' IS NOT NULL THEN
    BEGIN
      EXECUTE format('SELECT coalesce(title, session_type::text) FROM public.%I WHERE id = $1', v_session_tbl)
        INTO v_session_ttl USING (v_row->>'session_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_session_ttl := NULL;
    END;
  END IF;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    v_tenant,
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'module', v_module,
      'operation', lower(TG_OP),
      'member_name', NULLIF(v_member_name,''),
      'session_title', NULLIF(v_session_ttl,''),
      'before', v_before,
      'after', v_after
    ))
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_wofbi_attendance_records ON public.wofbi_attendance_records;
CREATE TRIGGER trg_audit_wofbi_attendance_records
AFTER INSERT OR UPDATE OR DELETE ON public.wofbi_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Bible School', 'record', 'wofbi_attendance_sessions');

DROP TRIGGER IF EXISTS trg_audit_wofbi_attendance_sessions ON public.wofbi_attendance_sessions;
CREATE TRIGGER trg_audit_wofbi_attendance_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.wofbi_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Bible School', 'session', '');

DROP TRIGGER IF EXISTS trg_audit_attendance_records ON public.attendance_records;
CREATE TRIGGER trg_audit_attendance_records
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Church', 'record', 'attendance_sessions');

DROP TRIGGER IF EXISTS trg_audit_attendance_sessions ON public.attendance_sessions;
CREATE TRIGGER trg_audit_attendance_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Church', 'session', '');

DROP TRIGGER IF EXISTS trg_audit_teen_attendance_records ON public.teen_attendance_records;
CREATE TRIGGER trg_audit_teen_attendance_records
AFTER INSERT OR UPDATE OR DELETE ON public.teen_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Teens', 'record', 'teen_attendance_sessions');

DROP TRIGGER IF EXISTS trg_audit_teen_attendance_sessions ON public.teen_attendance_sessions;
CREATE TRIGGER trg_audit_teen_attendance_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.teen_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Teens', 'session', '');

DROP TRIGGER IF EXISTS trg_audit_preteen_attendance_records ON public.preteen_attendance_records;
CREATE TRIGGER trg_audit_preteen_attendance_records
AFTER INSERT OR UPDATE OR DELETE ON public.preteen_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Preteens', 'record', 'preteen_attendance_sessions');

DROP TRIGGER IF EXISTS trg_audit_preteen_attendance_sessions ON public.preteen_attendance_sessions;
CREATE TRIGGER trg_audit_preteen_attendance_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.preteen_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Preteens', 'session', '');

DROP TRIGGER IF EXISTS trg_audit_wsf_attendance ON public.wsf_attendance;
CREATE TRIGGER trg_audit_wsf_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.wsf_attendance
FOR EACH ROW EXECUTE FUNCTION public.audit_attendance_change('Home Cell', 'record', '');