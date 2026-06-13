
-- =========================================================
-- Children Church: secure drop-off & pickup
-- =========================================================

-- Enable pgcrypto for digest() if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Helper: is user on Children Church unit ----------
CREATE OR REPLACE FUNCTION public.is_children_church_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND EXISTS (
        SELECT 1
        FROM unnest(string_to_array(COALESCE(m.church_unit,''), ',')) AS u
        WHERE lower(btrim(u)) IN ('children church','childrens church','children''s church')
      )
  ) OR EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('children church','childrens church','children''s church')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_children_church_leader(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(ula.unit_name)) IN ('children church','childrens church','children''s church')
  );
$$;

-- ---------- children ----------
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  primary_guardian_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IS NULL OR gender IN ('Male','Female')),
  age_group text CHECK (age_group IS NULL OR age_group IN ('Nursery','Toddler','Primary','Pre-Teen')),
  allergies text,
  medical_notes text,
  notes text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_children_tenant ON public.children(tenant_id);
CREATE INDEX idx_children_guardian ON public.children(primary_guardian_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians read their own children"
ON public.children FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = children.tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Guardians manage own children"
ON public.children FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = children.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Guardians update own children"
ON public.children FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = children.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
)
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Guardians delete own children"
ON public.children FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = primary_guardian_member_id AND m.user_id = auth.uid() AND m.tenant_id = children.tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE TRIGGER trg_children_updated BEFORE UPDATE ON public.children
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- child_guardians (authorised adults) ----------
CREATE TABLE public.child_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  relationship text,
  can_pickup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, member_id)
);
CREATE INDEX idx_child_guardians_tenant ON public.child_guardians(tenant_id);
CREATE INDEX idx_child_guardians_child ON public.child_guardians(child_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_guardians TO authenticated;
GRANT ALL ON public.child_guardians TO service_role;
ALTER TABLE public.child_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read guardians of accessible children"
ON public.child_guardians FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = child_id AND c.tenant_id = child_guardians.tenant_id
      AND m.user_id = auth.uid()
  )
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Primary guardian manages list"
ON public.child_guardians FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = child_id AND c.tenant_id = child_guardians.tenant_id
      AND m.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid(), tenant_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = child_id AND c.tenant_id = child_guardians.tenant_id
      AND m.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid(), tenant_id)
);

-- ---------- child_pickup_delegations ----------
CREATE TABLE public.child_pickup_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  issued_by_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  delegate_name text NOT NULL,
  delegate_phone text,
  code_hash text NOT NULL,
  valid_on date NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_worker_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pickup_deleg_tenant ON public.child_pickup_delegations(tenant_id);
CREATE INDEX idx_pickup_deleg_child ON public.child_pickup_delegations(child_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_pickup_delegations TO authenticated;
GRANT ALL ON public.child_pickup_delegations TO service_role;
ALTER TABLE public.child_pickup_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read delegations for own children or workers"
ON public.child_pickup_delegations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = issued_by_member_id AND m.user_id = auth.uid()
  )
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Guardian issues delegation"
ON public.child_pickup_delegations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = issued_by_member_id AND m.user_id = auth.uid() AND m.tenant_id = child_pickup_delegations.tenant_id)
  AND EXISTS (SELECT 1 FROM public.children c WHERE c.id = child_id AND c.tenant_id = child_pickup_delegations.tenant_id)
);

CREATE POLICY "Guardian revokes own delegation"
ON public.child_pickup_delegations FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = issued_by_member_id AND m.user_id = auth.uid())
  OR public.is_admin(auth.uid(), tenant_id)
);

-- ---------- child_checkins ----------
CREATE TABLE public.child_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  dropoff_at timestamptz NOT NULL DEFAULT now(),
  dropoff_worker_user_id uuid NOT NULL,
  dropoff_parent_member_id uuid NOT NULL REFERENCES public.members(id),
  pin_code_hash text NOT NULL,
  pickup_at timestamptz,
  pickup_worker_user_id uuid,
  pickup_adult_member_id uuid REFERENCES public.members(id),
  pickup_delegation_id uuid REFERENCES public.child_pickup_delegations(id),
  pickup_method text CHECK (pickup_method IS NULL OR pickup_method IN ('qr','pin','delegation_code','leader_override')),
  override_reason text,
  status text NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in','picked_up','flagged')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_tenant_date ON public.child_checkins(tenant_id, service_date);
CREATE INDEX idx_checkins_child ON public.child_checkins(child_id);
CREATE INDEX idx_checkins_status ON public.child_checkins(tenant_id, status);

GRANT SELECT, INSERT, UPDATE ON public.child_checkins TO authenticated;
GRANT ALL ON public.child_checkins TO service_role;
ALTER TABLE public.child_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read checkins: guardian, workers, admin"
ON public.child_checkins FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = child_id AND c.tenant_id = child_checkins.tenant_id AND m.user_id = auth.uid()
  )
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_admin(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
);

CREATE POLICY "Workers insert checkins"
ON public.child_checkins FOR INSERT TO authenticated
WITH CHECK (
  (public.is_children_church_member(auth.uid(), tenant_id) OR public.is_admin(auth.uid(), tenant_id))
  AND dropoff_worker_user_id = auth.uid()
);

CREATE POLICY "Workers update checkins"
ON public.child_checkins FOR UPDATE TO authenticated
USING (public.is_children_church_member(auth.uid(), tenant_id) OR public.is_admin(auth.uid(), tenant_id))
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_child_checkins_updated BEFORE UPDATE ON public.child_checkins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Audit trigger ----------
CREATE OR REPLACE FUNCTION public.audit_child_checkin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _name text;
BEGIN
  SELECT first_name || ' ' || last_name INTO _name FROM public.children WHERE id = COALESCE(NEW.child_id, OLD.child_id);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit('child_dropoff','child_checkins', NEW.id::text,
      jsonb_build_object('child_name',_name,'service_date',NEW.service_date,'dropoff_at',NEW.dropoff_at), NEW.tenant_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('picked_up','flagged') THEN
    PERFORM public.write_audit(
      CASE WHEN NEW.status = 'flagged' THEN 'child_pickup_flagged' ELSE 'child_pickup' END,
      'child_checkins', NEW.id::text,
      jsonb_build_object(
        'child_name',_name,
        'pickup_method',NEW.pickup_method,
        'pickup_adult_member_id',NEW.pickup_adult_member_id,
        'pickup_delegation_id',NEW.pickup_delegation_id,
        'override_reason',NEW.override_reason
      ), NEW.tenant_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_child_checkin
AFTER INSERT OR UPDATE ON public.child_checkins
FOR EACH ROW EXECUTE FUNCTION public.audit_child_checkin_change();

-- ---------- Secure release RPC (server-side gatekeeper) ----------
CREATE OR REPLACE FUNCTION public.release_child(
  _checkin_id uuid,
  _method text,
  _pin text DEFAULT NULL,
  _adult_member_id uuid DEFAULT NULL,
  _delegation_code text DEFAULT NULL,
  _override_reason text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS public.child_checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.child_checkins;
  _tenant uuid;
  _ok boolean := false;
  _deleg_id uuid;
  _is_leader boolean;
  _is_worker boolean;
  _is_admin boolean;
  _hash text;
BEGIN
  SELECT * INTO _row FROM public.child_checkins WHERE id = _checkin_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Check-in not found'; END IF;
  IF _row.status = 'picked_up' THEN RAISE EXCEPTION 'Already picked up'; END IF;
  _tenant := _row.tenant_id;

  _is_worker := public.is_children_church_member(auth.uid(), _tenant);
  _is_leader := public.is_children_church_leader(auth.uid(), _tenant);
  _is_admin := public.is_admin(auth.uid(), _tenant);
  IF NOT (_is_worker OR _is_admin) THEN
    RAISE EXCEPTION 'Not authorised to release children';
  END IF;

  IF _method = 'pin' THEN
    IF _pin IS NULL OR _adult_member_id IS NULL THEN RAISE EXCEPTION 'PIN and adult required'; END IF;
    _hash := encode(digest(_pin || '|' || _checkin_id::text, 'sha256'), 'hex');
    IF _hash <> _row.pin_code_hash THEN RAISE EXCEPTION 'Incorrect PIN'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.child_guardians g
      WHERE g.child_id = _row.child_id AND g.member_id = _adult_member_id AND g.can_pickup = true
    ) THEN
      RAISE EXCEPTION 'Adult is not on the authorised pickup list';
    END IF;
    _ok := true;
  ELSIF _method = 'qr' THEN
    IF _adult_member_id IS NULL THEN RAISE EXCEPTION 'Adult required'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.child_guardians g
      WHERE g.child_id = _row.child_id AND g.member_id = _adult_member_id AND g.can_pickup = true
    ) THEN
      RAISE EXCEPTION 'Adult is not on the authorised pickup list';
    END IF;
    _ok := true;
  ELSIF _method = 'delegation_code' THEN
    IF _delegation_code IS NULL THEN RAISE EXCEPTION 'Delegation code required'; END IF;
    _hash := encode(digest(upper(_delegation_code) || '|' || _row.child_id::text, 'sha256'), 'hex');
    SELECT id INTO _deleg_id FROM public.child_pickup_delegations
     WHERE child_id = _row.child_id
       AND tenant_id = _tenant
       AND code_hash = _hash
       AND used_at IS NULL
       AND expires_at > now()
       AND valid_on = _row.service_date
     LIMIT 1;
    IF _deleg_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired delegation code'; END IF;
    UPDATE public.child_pickup_delegations SET used_at = now(), used_by_worker_user_id = auth.uid() WHERE id = _deleg_id;
    _ok := true;
  ELSIF _method = 'leader_override' THEN
    IF NOT (_is_leader OR _is_admin) THEN RAISE EXCEPTION 'Only leaders may override'; END IF;
    IF _override_reason IS NULL OR length(btrim(_override_reason)) < 5 THEN RAISE EXCEPTION 'Override reason required'; END IF;
    _ok := true;
  ELSE
    RAISE EXCEPTION 'Unknown method: %', _method;
  END IF;

  IF NOT _ok THEN RAISE EXCEPTION 'Release denied'; END IF;

  UPDATE public.child_checkins
  SET pickup_at = now(),
      pickup_worker_user_id = auth.uid(),
      pickup_adult_member_id = _adult_member_id,
      pickup_delegation_id = _deleg_id,
      pickup_method = _method,
      override_reason = _override_reason,
      notes = COALESCE(_notes, notes),
      status = CASE WHEN _method = 'leader_override' THEN 'flagged' ELSE 'picked_up' END,
      updated_at = now()
  WHERE id = _checkin_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_child(uuid,text,text,uuid,text,text,text) TO authenticated;

-- ---------- Check-in helper RPC (hashes PIN with checkin id salt) ----------
CREATE OR REPLACE FUNCTION public.checkin_child(
  _child_id uuid,
  _pin text,
  _parent_member_id uuid
) RETURNS public.child_checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _new_id uuid := gen_random_uuid();
  _row public.child_checkins;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.children WHERE id = _child_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'Child not found'; END IF;

  IF NOT (public.is_children_church_member(auth.uid(), _tenant) OR public.is_admin(auth.uid(), _tenant)) THEN
    RAISE EXCEPTION 'Only Children Church workers can check in';
  END IF;
  IF _pin IS NULL OR length(_pin) <> 6 THEN RAISE EXCEPTION 'PIN must be 6 digits'; END IF;

  INSERT INTO public.child_checkins(
    id, tenant_id, child_id, service_date, dropoff_at, dropoff_worker_user_id,
    dropoff_parent_member_id, pin_code_hash, status
  ) VALUES (
    _new_id, _tenant, _child_id, CURRENT_DATE, now(), auth.uid(),
    _parent_member_id,
    encode(digest(_pin || '|' || _new_id::text, 'sha256'), 'hex'),
    'checked_in'
  ) RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkin_child(uuid,text,uuid) TO authenticated;

-- ---------- Ensure Children Church unit exists for each tenant on demand (no-op insert if you already have config UI) ----------
