
-- 1. Add 'Visitor' to followup_type enum
ALTER TYPE public.followup_type ADD VALUE IF NOT EXISTS 'Visitor';

-- 2. Create followup_message_templates table
CREATE TABLE public.followup_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  followup_type text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  subject text,
  message_template text NOT NULL,
  delay_days integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates in their tenant"
  ON public.followup_message_templates FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can manage templates"
  ON public.followup_message_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

-- 3. Update auto_create_followup trigger to include Visitor and auto-schedule messages
CREATE OR REPLACE FUNCTION public.auto_create_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _followup_id uuid;
  _assigned_user uuid;
  _fu_user record;
  _desc text;
  _type text;
  _supabase_url text;
  _service_key text;
  _tmpl record;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.membership_status IN ('First Timer', 'New Convert', 'Visitor'))
     OR (TG_OP = 'UPDATE' AND OLD.membership_status IS DISTINCT FROM NEW.membership_status AND NEW.membership_status IN ('First Timer', 'New Convert', 'Visitor'))
  THEN
    _type := NEW.membership_status;

    IF TG_OP = 'INSERT' THEN
      _desc := CASE
        WHEN NEW.membership_status = 'First Timer' THEN 'New first timer registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and connect them to the church.'
        WHEN NEW.membership_status = 'Visitor' THEN 'New visitor registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Welcome and invite them back.'
        ELSE 'New convert registered: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    ELSE
      _desc := CASE
        WHEN NEW.membership_status = 'First Timer' THEN 'Member status changed to First Timer: ' || NEW.first_name || ' ' || NEW.last_name
        WHEN NEW.membership_status = 'Visitor' THEN 'Member status changed to Visitor: ' || NEW.first_name || ' ' || NEW.last_name
        ELSE 'Member status changed to New Convert: ' || NEW.first_name || ' ' || NEW.last_name || '. Enrol in BFC and assign a mentor.'
      END;
    END IF;

    SELECT pool.user_id INTO _assigned_user
    FROM (
      SELECT ula.user_id
      FROM public.unit_leader_assignments ula
      WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
        AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
      UNION
      SELECT m.user_id
      FROM public.members m
      WHERE m.user_id IS NOT NULL
        AND m.tenant_id = NEW.tenant_id
        AND (lower(m.church_unit) LIKE '%follow-up%' OR lower(m.church_unit) LIKE '%follow up%')
    ) pool
    ORDER BY (
      SELECT COUNT(*) FROM public.followups f
      WHERE f.assigned_to = pool.user_id AND f.status IN ('Pending', 'In Progress')
    ) ASC, random()
    LIMIT 1;

    INSERT INTO public.followups (member_id, followup_type, status, priority, description, created_by, assigned_to, tenant_id)
    VALUES (NEW.id, _type::followup_type, 'Pending', 'High', _desc, NEW.user_id, _assigned_user, NEW.tenant_id)
    RETURNING id INTO _followup_id;

    -- Auto-schedule messages from templates
    FOR _tmpl IN
      SELECT * FROM public.followup_message_templates
      WHERE followup_type = _type
        AND is_active = true
        AND tenant_id = NEW.tenant_id
      ORDER BY sort_order, delay_days
    LOOP
      INSERT INTO public.followup_scheduled_messages (
        followup_id, member_id, channel, recipient_phone, recipient_email,
        recipient_name, subject, message, status, scheduled_at,
        created_by, tenant_id
      ) VALUES (
        _followup_id,
        NEW.id,
        _tmpl.channel::followup_message_channel,
        NEW.phone,
        NEW.email,
        NEW.first_name || ' ' || NEW.last_name,
        _tmpl.subject,
        _tmpl.message_template,
        'scheduled',
        NOW() + (_tmpl.delay_days * interval '1 day'),
        _assigned_user,
        NEW.tenant_id
      );
    END LOOP;

    -- Notify follow-up unit leaders/members
    FOR _fu_user IN
      SELECT sub.user_id FROM (
        SELECT ula.user_id FROM public.unit_leader_assignments ula
        WHERE ula.unit_name IN ('Follow-up', 'Follow-Up', 'follow-up')
          AND (NEW.tenant_id IS NULL OR ula.tenant_id = NEW.tenant_id)
        UNION
        SELECT m2.user_id FROM public.members m2
        WHERE m2.user_id IS NOT NULL
          AND m2.tenant_id = NEW.tenant_id
          AND (lower(m2.church_unit) LIKE '%follow-up%' OR lower(m2.church_unit) LIKE '%follow up%')
      ) sub
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
      VALUES (
        _fu_user.user_id,
        'New ' || _type || ' Follow-up',
        _desc,
        'followup',
        _followup_id::text,
        'followup',
        NEW.tenant_id
      );
    END LOOP;

    -- Send email/SMS notification to assigned user via edge function
    IF _assigned_user IS NOT NULL THEN
      SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
      SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
      IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := _supabase_url || '/functions/v1/notify-followup-assignment',
          body := jsonb_build_object(
            'assigned_to', _assigned_user,
            'followup_type', _type,
            'member_name', NEW.first_name || ' ' || NEW.last_name,
            'followup_id', _followup_id,
            'tenant_id', NEW.tenant_id
          )::text,
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || _service_key)::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
