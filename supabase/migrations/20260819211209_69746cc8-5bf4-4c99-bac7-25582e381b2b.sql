CREATE OR REPLACE FUNCTION public.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  secret_re text := '(pin|token|secret|password|hash|api_key|_key)$|(pin_hash|access_token|refresh_token)';
  content_re text := '^(content|body|notes?|message|description|answer|answer_text|response|response_text|comment|comments|testimony|prayer_request|details|feedback|reason|address|address_line1|address_line2|medical_notes|allergies|special_needs)$';
  content_only_tables text[] := ARRAY['sermon_notes','testimonies','pastoral_care','messages','wofbi_feedback_responses','lecturer_ratings','app_feedback'];
  is_content_only boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  is_content_only := v_tbl = ANY(content_only_tables);

  FOR k, v_val IN SELECT key, value FROM jsonb_each(v_old) LOOP
    IF k = ANY(noise) THEN CONTINUE; END IF;
    IF k ~* secret_re THEN
      v_before := v_before || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[redacted]'::text) END);
    ELSIF k ~* content_re THEN
      v_before := v_before || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[content hidden]'::text) END);
    ELSE
      v_before := v_before || jsonb_build_object(k, v_val);
    END IF;
  END LOOP;
  FOR k, v_val IN SELECT key, value FROM jsonb_each(v_new) LOOP
    IF k = ANY(noise) THEN CONTINUE; END IF;
    IF k ~* secret_re THEN
      v_after := v_after || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[redacted]'::text) END);
    ELSIF k ~* content_re THEN
      v_after := v_after || jsonb_build_object(k, CASE WHEN v_val = 'null'::jsonb THEN v_val ELSE to_jsonb('[content hidden]'::text) END);
    ELSE
      v_after := v_after || jsonb_build_object(k, v_val);
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' AND v_before = v_after THEN
    RETURN NEW;
  END IF;

  v_action := v_tbl || '_' || CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;

  BEGIN
    v_tenant := COALESCE(v_new->>'tenant_id', v_old->>'tenant_id')::uuid;
  EXCEPTION WHEN others THEN v_tenant := NULL;
  END;

  v_entity := COALESCE(v_new->>'id', v_old->>'id', v_new->>'user_id', v_old->>'user_id');

  IF is_content_only THEN
    v_before := NULL;
    v_after := NULL;
  END IF;

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
      'content_hidden', is_content_only,
      'before', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE v_before END,
      'after', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_after END
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- One-off cleanup of already-stored personal content in the audit trail.
ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_no_update;

-- 1) Content-only tables: drop before/after payloads entirely.
UPDATE public.audit_log
SET details = (details - 'before' - 'after')
              || jsonb_build_object('content_hidden', true, 'before', NULL, 'after', NULL)
WHERE entity_type IN ('sermon_notes','testimonies','pastoral_care','messages','wofbi_feedback_responses','lecturer_ratings','app_feedback')
  AND details ? 'before';

-- 2) All other tables: replace sensitive content field values with a marker.
WITH targets AS (
  SELECT id, details FROM public.audit_log
  WHERE details ? 'before' OR details ? 'after'
),
scrubbed AS (
  SELECT
    t.id,
    t.details
      || jsonb_build_object(
        'before', CASE WHEN jsonb_typeof(t.details->'before') = 'object' THEN (
            SELECT jsonb_object_agg(
              k,
              CASE WHEN k ~* '^(content|body|notes?|message|description|answer|answer_text|response|response_text|comment|comments|testimony|prayer_request|details|feedback|reason|address|address_line1|address_line2|medical_notes|allergies|special_needs)$'
                        AND v <> 'null'::jsonb
                   THEN to_jsonb('[content hidden]'::text) ELSE v END)
            FROM jsonb_each(t.details->'before') AS e(k, v)
          ) ELSE t.details->'before' END,
        'after', CASE WHEN jsonb_typeof(t.details->'after') = 'object' THEN (
            SELECT jsonb_object_agg(
              k,
              CASE WHEN k ~* '^(content|body|notes?|message|description|answer|answer_text|response|response_text|comment|comments|testimony|prayer_request|details|feedback|reason|address|address_line1|address_line2|medical_notes|allergies|special_needs)$'
                        AND v <> 'null'::jsonb
                   THEN to_jsonb('[content hidden]'::text) ELSE v END)
            FROM jsonb_each(t.details->'after') AS e(k, v)
          ) ELSE t.details->'after' END
      ) AS new_details
  FROM targets t
)
UPDATE public.audit_log a
SET details = s.new_details
FROM scrubbed s
WHERE a.id = s.id AND a.details IS DISTINCT FROM s.new_details;

ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_update;