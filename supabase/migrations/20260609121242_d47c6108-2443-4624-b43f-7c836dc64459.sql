
-- Helpers: training rep unit member / leader checks (recursion-safe)
CREATE OR REPLACE FUNCTION public.is_training_rep_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.church_unit IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM regexp_split_to_table(m.church_unit, ',') AS u
        WHERE lower(btrim(u)) IN ('training rep','training reps','training')
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_training_rep_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_training_rep_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('training rep','training reps','training')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_training_rep_leader(uuid, uuid) TO authenticated, service_role;

-- Main table
CREATE TABLE public.training_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  training_report_id uuid NOT NULL REFERENCES public.training_reports(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  training_type text NOT NULL,
  attended boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  not_completed_reason text,
  signpost_status text NOT NULL DEFAULT 'none' CHECK (signpost_status IN ('none','pending','approved','declined','issued')),
  signposted_by uuid,
  signposted_at timestamptz,
  decision_by uuid,
  decision_at timestamptz,
  decision_notes text,
  certificate_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_report_id, member_id)
);

CREATE INDEX idx_training_attendees_tenant ON public.training_attendees(tenant_id);
CREATE INDEX idx_training_attendees_report ON public.training_attendees(training_report_id);
CREATE INDEX idx_training_attendees_member ON public.training_attendees(member_id);
CREATE INDEX idx_training_attendees_status ON public.training_attendees(tenant_id, signpost_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_attendees TO authenticated;
GRANT ALL ON public.training_attendees TO service_role;

ALTER TABLE public.training_attendees ENABLE ROW LEVEL SECURITY;

-- SELECT: any user in tenant
CREATE POLICY "Tenant members can view attendees"
  ON public.training_attendees FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

-- INSERT: training reps or admins
CREATE POLICY "Training reps can add attendees"
  ON public.training_attendees FOR INSERT TO authenticated
  WITH CHECK (
    user_has_tenant_access(tenant_id)
    AND (is_admin(auth.uid(), tenant_id) OR is_training_rep_member(auth.uid(), tenant_id))
  );

-- UPDATE: training reps, training rep leaders, or admins. Column-level rules enforced by trigger below.
CREATE POLICY "Training reps and leaders can update attendees"
  ON public.training_attendees FOR UPDATE TO authenticated
  USING (
    user_has_tenant_access(tenant_id)
    AND (
      is_admin(auth.uid(), tenant_id)
      OR is_training_rep_member(auth.uid(), tenant_id)
      OR is_training_rep_leader(auth.uid(), tenant_id)
    )
  )
  WITH CHECK (
    user_has_tenant_access(tenant_id)
    AND (
      is_admin(auth.uid(), tenant_id)
      OR is_training_rep_member(auth.uid(), tenant_id)
      OR is_training_rep_leader(auth.uid(), tenant_id)
    )
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete attendees"
  ON public.training_attendees FOR DELETE TO authenticated
  USING (is_admin(auth.uid(), tenant_id));

-- updated_at trigger
CREATE TRIGGER trg_training_attendees_updated_at
  BEFORE UPDATE ON public.training_attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Column-scoped permission + audit + notification trigger
CREATE OR REPLACE FUNCTION public.training_attendees_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_admin boolean;
  _is_rep boolean;
  _is_leader boolean;
  _leader_id uuid;
  _member_name text;
BEGIN
  _is_admin := is_admin(auth.uid(), NEW.tenant_id);
  _is_rep := is_training_rep_member(auth.uid(), NEW.tenant_id);
  _is_leader := is_training_rep_leader(auth.uid(), NEW.tenant_id);

  IF TG_OP = 'UPDATE' THEN
    -- Decision column changes only by leaders/admins
    IF (NEW.signpost_status IS DISTINCT FROM OLD.signpost_status
        AND NEW.signpost_status IN ('approved','declined','issued'))
       OR NEW.decision_by IS DISTINCT FROM OLD.decision_by
       OR NEW.decision_notes IS DISTINCT FROM OLD.decision_notes
       OR NEW.certificate_number IS DISTINCT FROM OLD.certificate_number
    THEN
      IF NOT (_is_admin OR _is_leader) THEN
        RAISE EXCEPTION 'Only the Training Rep unit leader or an admin can change decision fields';
      END IF;
    END IF;

    -- Signpost (status -> pending) only by reps/admins
    IF NEW.signpost_status = 'pending' AND OLD.signpost_status IS DISTINCT FROM 'pending' THEN
      IF NOT (_is_admin OR _is_rep) THEN
        RAISE EXCEPTION 'Only Training Rep members or admins can signpost';
      END IF;
    END IF;
  END IF;

  -- Tenant immutability
  IF TG_OP = 'UPDATE' AND NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_training_attendees_guard
  BEFORE UPDATE ON public.training_attendees
  FOR EACH ROW EXECUTE FUNCTION public.training_attendees_guard();

-- Notify Training Rep leaders when status becomes 'pending'
CREATE OR REPLACE FUNCTION public.training_attendees_notify_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _member_name text;
  _leader record;
BEGIN
  IF NEW.signpost_status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.signpost_status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT (first_name || ' ' || last_name) INTO _member_name
    FROM public.members WHERE id = NEW.member_id;

  FOR _leader IN
    SELECT ula.user_id
      FROM public.unit_leader_assignments ula
     WHERE ula.tenant_id = NEW.tenant_id
       AND lower(btrim(ula.unit_name)) IN ('training rep','training reps','training')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type, tenant_id)
    VALUES (
      _leader.user_id,
      'Certificate signpost: ' || COALESCE(_member_name, 'member'),
      COALESCE(_member_name, 'A member') || ' has been signposted for a ' || NEW.training_type || ' certificate.',
      'general',
      NEW.id::text,
      'certificate_signpost',
      NEW.tenant_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_training_attendees_notify_pending_ins
  AFTER INSERT ON public.training_attendees
  FOR EACH ROW EXECUTE FUNCTION public.training_attendees_notify_pending();

CREATE TRIGGER trg_training_attendees_notify_pending_upd
  AFTER UPDATE ON public.training_attendees
  FOR EACH ROW EXECUTE FUNCTION public.training_attendees_notify_pending();
