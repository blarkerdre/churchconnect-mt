
ALTER TABLE public.audit_log ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log (user_id);

CREATE OR REPLACE FUNCTION public.audit_log_block_modify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('audit.internal', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;
DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_modify();

DROP POLICY IF EXISTS "Tenant admins can view their audit log" ON public.audit_log;
CREATE POLICY "Tenant admins can view their audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (tenant_id IS NOT NULL AND public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_log;
CREATE POLICY "Admins can insert audit logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  AND (user_id IS NULL OR auth.uid() = user_id)
);

CREATE OR REPLACE FUNCTION public.write_audit(
  _action text, _entity_type text, _entity_id text,
  _details jsonb, _tenant_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  BEGIN _uid := auth.uid(); EXCEPTION WHEN OTHERS THEN _uid := NULL; END;
  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (_uid, _tenant_id, _action, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_diff(_old jsonb, _new jsonb, _ignore text[] DEFAULT ARRAY['updated_at','created_at']::text[])
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; v jsonb; before_j jsonb := '{}'::jsonb; after_j jsonb := '{}'::jsonb;
BEGIN
  IF _new IS NULL THEN RETURN jsonb_build_object('before', _old, 'after', null); END IF;
  IF _old IS NULL THEN RETURN jsonb_build_object('before', null, 'after', _new); END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_new) LOOP
    IF k = ANY(_ignore) THEN CONTINUE; END IF;
    IF (_old->k) IS DISTINCT FROM v THEN
      before_j := before_j || jsonb_build_object(k, _old->k);
      after_j := after_j || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  IF after_j = '{}'::jsonb THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('before', before_j, 'after', after_j);
END;
$$;

-- members
CREATE OR REPLACE FUNCTION public.audit_members_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _diff jsonb; _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _name := COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'');
    PERFORM public.write_audit('member_create','members',NEW.id::text,
      jsonb_build_object('member_name',_name,'email',NEW.email,'phone',NEW.phone), NEW.tenant_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _diff := public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
    IF _diff IS NULL THEN RETURN NEW; END IF;
    _name := COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'');
    PERFORM public.write_audit('member_update','members',NEW.id::text,
      jsonb_build_object('member_name',_name) || _diff, NEW.tenant_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    _name := COALESCE(OLD.first_name,'') || ' ' || COALESCE(OLD.last_name,'');
    PERFORM public.write_audit('member_delete','members',OLD.id::text,
      jsonb_build_object('member_name',_name,'email',OLD.email), OLD.tenant_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_members ON public.members;
CREATE TRIGGER trg_audit_members AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.audit_members_change();

-- notifications (collapsed)
CREATE OR REPLACE FUNCTION public.audit_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text; _existing uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  _key := COALESCE(NEW.reference_type,'general') || ':' || COALESCE(NEW.reference_id, NEW.id::text);
  SELECT id INTO _existing FROM public.audit_log
  WHERE tenant_id = NEW.tenant_id AND action='notification_sent' AND entity_id=_key
    AND created_at > now() - interval '2 minutes' LIMIT 1;
  IF _existing IS NOT NULL THEN
    PERFORM set_config('audit.internal','on',true);
    UPDATE public.audit_log
    SET details = jsonb_set(details,'{recipients_count}', to_jsonb(COALESCE((details->>'recipients_count')::int,0)+1))
    WHERE id = _existing;
    PERFORM set_config('audit.internal','off',true);
  ELSE
    PERFORM public.write_audit('notification_sent','notifications',_key,
      jsonb_build_object('title',NEW.title,'type',NEW.type,
        'reference_type',NEW.reference_type,'reference_id',NEW.reference_id,
        'recipients_count',1,'channel','in_app'), NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_notifications ON public.notifications;
CREATE TRIGGER trg_audit_notifications AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.audit_notification_insert();

-- pastoral_care
CREATE OR REPLACE FUNCTION public.audit_pastoral_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.write_audit('pastoral_case_create','pastoral_care',NEW.id::text,
      jsonb_build_object('subject',NEW.subject,'care_type',NEW.care_type,'assigned_to',NEW.assigned_to,'status',NEW.status), NEW.tenant_id);
  ELSIF TG_OP='UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.write_audit('pastoral_status_change','pastoral_care',NEW.id::text,
        jsonb_build_object('subject',NEW.subject,'before',jsonb_build_object('status',OLD.status),'after',jsonb_build_object('status',NEW.status)), NEW.tenant_id);
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.write_audit('pastoral_assignment','pastoral_care',NEW.id::text,
        jsonb_build_object('subject',NEW.subject,'before',jsonb_build_object('assigned_to',OLD.assigned_to),'after',jsonb_build_object('assigned_to',NEW.assigned_to)), NEW.tenant_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_pastoral ON public.pastoral_care;
CREATE TRIGGER trg_audit_pastoral AFTER INSERT OR UPDATE ON public.pastoral_care
FOR EACH ROW EXECUTE FUNCTION public.audit_pastoral_change();

-- transportation
CREATE OR REPLACE FUNCTION public.audit_transport_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.write_audit('transport_create','transportation',NEW.id::text,
      jsonb_build_object('member_id',NEW.member_id,'pickup',NEW.pickup_address,'destination',NEW.destination,'request_date',NEW.request_date,'status',NEW.status), NEW.tenant_id);
  ELSIF TG_OP='UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.write_audit('transport_status_change','transportation',NEW.id::text,
        jsonb_build_object('before',jsonb_build_object('status',OLD.status),'after',jsonb_build_object('status',NEW.status)), NEW.tenant_id);
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.write_audit('transport_assignment','transportation',NEW.id::text,
        jsonb_build_object('before',jsonb_build_object('assigned_to',OLD.assigned_to),'after',jsonb_build_object('assigned_to',NEW.assigned_to)), NEW.tenant_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_transport ON public.transportation;
CREATE TRIGGER trg_audit_transport AFTER INSERT OR UPDATE ON public.transportation
FOR EACH ROW EXECUTE FUNCTION public.audit_transport_change();

-- followup_referrals
CREATE OR REPLACE FUNCTION public.audit_followup_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.write_audit('followup_create','followup_referrals',NEW.id::text,
      jsonb_build_object('member_id',NEW.member_id,'status',NEW.status,'assigned_leader_id',NEW.assigned_leader_id), NEW.tenant_id);
  ELSIF TG_OP='UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.write_audit('followup_status_change','followup_referrals',NEW.id::text,
        jsonb_build_object('before',jsonb_build_object('status',OLD.status),'after',jsonb_build_object('status',NEW.status)), NEW.tenant_id);
    END IF;
    IF OLD.assigned_leader_id IS DISTINCT FROM NEW.assigned_leader_id THEN
      PERFORM public.write_audit('followup_assignment','followup_referrals',NEW.id::text,
        jsonb_build_object('before',jsonb_build_object('assigned_leader_id',OLD.assigned_leader_id),'after',jsonb_build_object('assigned_leader_id',NEW.assigned_leader_id)), NEW.tenant_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_followups ON public.followup_referrals;
CREATE TRIGGER trg_audit_followups AFTER INSERT OR UPDATE ON public.followup_referrals
FOR EACH ROW EXECUTE FUNCTION public.audit_followup_change();

-- tenants
CREATE OR REPLACE FUNCTION public.audit_tenant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _diff jsonb;
BEGIN
  _diff := public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW),
    ARRAY['updated_at','created_at','last_payment_at','setup_complete']::text[]);
  IF _diff IS NULL THEN RETURN NEW; END IF;
  PERFORM public.write_audit('tenant_settings_update','tenants',NEW.id::text,
    jsonb_build_object('tenant_name',NEW.name) || _diff, NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_tenant ON public.tenants;
CREATE TRIGGER trg_audit_tenant AFTER UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_change();

-- tenant_invoices
CREATE OR REPLACE FUNCTION public.audit_invoice_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.write_audit('invoice_status_change','tenant_invoices',NEW.id::text,
      jsonb_build_object('invoice_number',NEW.invoice_number,
        'before',jsonb_build_object('status',OLD.status),
        'after',jsonb_build_object('status',NEW.status)), NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_invoice ON public.tenant_invoices;
CREATE TRIGGER trg_audit_invoice AFTER UPDATE ON public.tenant_invoices
FOR EACH ROW EXECUTE FUNCTION public.audit_invoice_change();

-- member_status_history mirror
CREATE OR REPLACE FUNCTION public.audit_member_status_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT first_name || ' ' || last_name INTO _name FROM public.members WHERE id = NEW.member_id;
  PERFORM public.write_audit('member_status_change','members',NEW.member_id::text,
    jsonb_build_object('member_name',_name,
      'before',jsonb_build_object('status',NEW.previous_status),
      'after',jsonb_build_object('status',NEW.new_status)), NEW.tenant_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_member_status ON public.member_status_history;
CREATE TRIGGER trg_audit_member_status AFTER INSERT ON public.member_status_history
FOR EACH ROW EXECUTE FUNCTION public.audit_member_status_history();
