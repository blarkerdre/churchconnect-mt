-- Module mapping helper
CREATE OR REPLACE FUNCTION public.audit_module_for_table(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _t IN ('members','member_status_history','member_claim_invites','contacts','child_guardians','child_pickup_delegations','children','child_checkins','consent_events','first_timers') THEN 'Members'
    WHEN _t LIKE 'wofbi%' OR _t LIKE 'exam%' OR _t IN ('lecturers','lecturer_ratings','lecturer_qc_checks','course_registrations','books_of_the_month','certificate_templates','training_completions') THEN 'Bible School'
    WHEN _t LIKE '%attendance%' THEN 'Attendance'
    WHEN _t LIKE 'teen%' THEN 'Teens'
    WHEN _t LIKE 'preteen%' THEN 'Preteens'
    WHEN _t LIKE 'unit_task%' OR _t IN ('unit_join_requests','unit_leader_assignments','church_units') THEN 'Units & Tasks'
    WHEN _t LIKE 'wsf%' THEN 'Home Cell'
    WHEN _t LIKE 'followup%' THEN 'Follow-ups'
    WHEN _t LIKE 'event%' OR _t IN ('announcements','testimonies','sermon_notes','sermon_note_folders') THEN 'Events & Comms'
    WHEN _t LIKE 'inventory%' THEN 'Inventory'
    WHEN _t LIKE 'tenant%' OR _t IN ('tenants','pricing_plans','pricing_cost_inputs','platform_alerts','sla_templates','trustpilot_reviews','trustpilot_settings','domifort_api_tokens','domifort_bookings') THEN 'Administration'
    WHEN _t IN ('data_export_requests','erasure_requests','retention_policies','suppressed_emails','documents') THEN 'Privacy & Documents'
    WHEN _t IN ('app_settings','followup_message_templates','birthday_message_settings','certificate_templates') THEN 'Settings'
    WHEN _t IN ('transportation','driver_availability','pickup_locations') THEN 'Transportation'
    WHEN _t IN ('pastoral_care','life_event_requests') THEN 'Pastoral Care'
    WHEN _t LIKE 'training%' THEN 'Training'
    ELSE 'Other'
  END
$$;

-- Human label helper
CREATE OR REPLACE FUNCTION public.audit_label_for_table(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT initcap(replace(regexp_replace(_t, 's$', ''), '_', ' '))
$$;

-- Generic row-change audit trigger
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_tbl text := TG_TABLE_NAME;
  v_action text;
  v_tenant uuid;
  v_entity text;
  k text;
  v_val jsonb;
  noise text[] := ARRAY['updated_at','created_at','search_vector'];
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  -- Redact + strip noise
  FOR k, v_val IN SELECT key, value FROM jsonb_each(v_old) LOOP
    IF k = ANY(noise) THEN CONTINUE; END IF;
    IF k ~* '(pin|token|secret|password|hash|api_key|_key)$' OR k ~* '(pin_hash|access_token|refresh_token)' THEN
      v_before := v_before || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[redacted]'::text) END);
    ELSE
      v_before := v_before || jsonb_build_object(k, v_val);
    END IF;
  END LOOP;
  FOR k, v_val IN SELECT key, value FROM jsonb_each(v_new) LOOP
    IF k = ANY(noise) THEN CONTINUE; END IF;
    IF k ~* '(pin|token|secret|password|hash|api_key|_key)$' OR k ~* '(pin_hash|access_token|refresh_token)' THEN
      v_after := v_after || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[redacted]'::text) END);
    ELSE
      v_after := v_after || jsonb_build_object(k, v_val);
    END IF;
  END LOOP;

  -- Skip no-op updates
  IF TG_OP = 'UPDATE' AND v_before = v_after THEN
    RETURN NEW;
  END IF;

  v_action := v_tbl || '_' || CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;

  BEGIN
    v_tenant := COALESCE(v_new->>'tenant_id', v_old->>'tenant_id')::uuid;
  EXCEPTION WHEN others THEN v_tenant := NULL;
  END;

  v_entity := COALESCE(v_new->>'id', v_old->>'id', v_new->>'user_id', v_old->>'user_id');

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    v_tenant,
    v_action,
    v_tbl,
    v_entity,
    jsonb_build_object(
      'module', public.audit_module_for_table(v_tbl),
      'label', public.audit_label_for_table(v_tbl),
      'action', lower(TG_OP),
      'before', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE v_before END,
      'after', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_after END
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- auditing must never block the user's action
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Attach to all eligible tables
DO $do$
DECLARE
  r record;
  excluded text[] := ARRAY[
    'audit_log','notifications','email_send_log','email_send_state','email_unsubscribe_tokens',
    'sms_log','call_log','scheduled_communications','followup_scheduled_messages','push_subscriptions',
    'public_endpoint_rate_limits','tenant_usage_counters','domifort_ingest_log','birthday_message_log',
    'purged_data_archives','user_tour_completions','announcement_reactions','event_reactions','messages',
    'exam_answers','audit_log_archive','profiles'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY(excluded))
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = c.oid AND NOT t.tgisinternal AND t.tgname ILIKE '%audit%'
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_generic_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
      r.tbl
    );
  END LOOP;
END
$do$;