-- 1. Create the table
CREATE TABLE public.unit_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('unit', 'home_cell')),
  unit_name text,
  wsf_centre_id uuid REFERENCES public.wsf_centres(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_join_requests_target_check CHECK (
    (request_type = 'unit' AND unit_name IS NOT NULL AND wsf_centre_id IS NULL) OR
    (request_type = 'home_cell' AND wsf_centre_id IS NOT NULL AND unit_name IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_ujr_tenant_status ON public.unit_join_requests(tenant_id, status);
CREATE INDEX idx_ujr_member ON public.unit_join_requests(member_id);
CREATE INDEX idx_ujr_unit_name ON public.unit_join_requests(unit_name) WHERE unit_name IS NOT NULL;
CREATE INDEX idx_ujr_centre ON public.unit_join_requests(wsf_centre_id) WHERE wsf_centre_id IS NOT NULL;

-- One pending request per (member, type, target)
CREATE UNIQUE INDEX idx_ujr_unique_pending_unit
  ON public.unit_join_requests(member_id, lower(unit_name))
  WHERE status = 'pending' AND request_type = 'unit';
CREATE UNIQUE INDEX idx_ujr_unique_pending_centre
  ON public.unit_join_requests(member_id, wsf_centre_id)
  WHERE status = 'pending' AND request_type = 'home_cell';

-- Updated-at trigger
CREATE TRIGGER trg_ujr_updated_at
  BEFORE UPDATE ON public.unit_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Enable RLS
ALTER TABLE public.unit_join_requests ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a Home Cell leader for this centre (in this tenant)?
CREATE OR REPLACE FUNCTION public.is_home_cell_leader_for_centre(_user_id uuid, _centre_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = _centre_id
      AND wc.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  );
$$;

-- 3. RLS Policies

-- Members can view their own requests
CREATE POLICY "Members view own join requests"
ON public.unit_join_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = unit_join_requests.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = unit_join_requests.tenant_id
  )
);

-- Admins view all in tenant
CREATE POLICY "Admins view all join requests"
ON public.unit_join_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid(), tenant_id));

-- Unit leaders view requests for their units
CREATE POLICY "Unit leaders view their unit join requests"
ON public.unit_join_requests FOR SELECT
TO authenticated
USING (
  request_type = 'unit'
  AND public.is_unit_leader_for_session(auth.uid(), unit_name, tenant_id)
);

-- Home Cell leaders view requests for their centres
CREATE POLICY "Home Cell leaders view their centre join requests"
ON public.unit_join_requests FOR SELECT
TO authenticated
USING (
  request_type = 'home_cell'
  AND public.is_home_cell_leader_for_centre(auth.uid(), wsf_centre_id, tenant_id)
);

-- Members can insert their own requests
CREATE POLICY "Members create own join requests"
ON public.unit_join_requests FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = unit_join_requests.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = unit_join_requests.tenant_id
  )
);

-- Admins can insert (acting on behalf, though normally they'd direct-assign)
CREATE POLICY "Admins create join requests"
ON public.unit_join_requests FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid(), tenant_id));

-- Members can update only to cancel their own pending requests
CREATE POLICY "Members cancel own pending requests"
ON public.unit_join_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = unit_join_requests.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = unit_join_requests.tenant_id
  )
)
WITH CHECK (status = 'cancelled');

-- Admins can update anything
CREATE POLICY "Admins update join requests"
ON public.unit_join_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_admin(auth.uid(), tenant_id));

-- Unit leaders can update unit requests
CREATE POLICY "Unit leaders update their unit join requests"
ON public.unit_join_requests FOR UPDATE
TO authenticated
USING (
  request_type = 'unit'
  AND public.is_unit_leader_for_session(auth.uid(), unit_name, tenant_id)
)
WITH CHECK (
  request_type = 'unit'
  AND public.is_unit_leader_for_session(auth.uid(), unit_name, tenant_id)
);

-- Home Cell leaders can update centre requests
CREATE POLICY "Home Cell leaders update their centre join requests"
ON public.unit_join_requests FOR UPDATE
TO authenticated
USING (
  request_type = 'home_cell'
  AND public.is_home_cell_leader_for_centre(auth.uid(), wsf_centre_id, tenant_id)
)
WITH CHECK (
  request_type = 'home_cell'
  AND public.is_home_cell_leader_for_centre(auth.uid(), wsf_centre_id, tenant_id)
);

-- 4. Approve function
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _is_admin boolean;
  _can_approve boolean;
  _member_user_id uuid;
  _target_label text;
  _existing_units text;
  _new_units text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _req FROM public.unit_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  _is_admin := public.is_admin(auth.uid(), _req.tenant_id);
  _can_approve := _is_admin;

  IF NOT _can_approve AND _req.request_type = 'unit' THEN
    _can_approve := public.is_unit_leader_for_session(auth.uid(), _req.unit_name, _req.tenant_id);
  END IF;
  IF NOT _can_approve AND _req.request_type = 'home_cell' THEN
    _can_approve := public.is_home_cell_leader_for_centre(auth.uid(), _req.wsf_centre_id, _req.tenant_id);
  END IF;

  IF NOT _can_approve THEN
    RAISE EXCEPTION 'You are not authorized to approve this request';
  END IF;

  -- Apply to member
  IF _req.request_type = 'unit' THEN
    SELECT church_unit INTO _existing_units FROM public.members WHERE id = _req.member_id;
    -- Dedup case-insensitive
    IF _existing_units IS NULL OR btrim(_existing_units) = '' THEN
      _new_units := _req.unit_name;
    ELSIF EXISTS (
      SELECT 1 FROM unnest(string_to_array(_existing_units, ',')) AS t(u)
      WHERE lower(btrim(t.u)) = lower(btrim(_req.unit_name))
    ) THEN
      _new_units := _existing_units;
    ELSE
      _new_units := _existing_units || ', ' || _req.unit_name;
    END IF;
    UPDATE public.members
    SET church_unit = _new_units, updated_at = now()
    WHERE id = _req.member_id;
    _target_label := _req.unit_name;
  ELSE
    UPDATE public.members
    SET wsf_centre_id = _req.wsf_centre_id,
        winners_satellite = true,
        updated_at = now()
    WHERE id = _req.member_id;
    SELECT name INTO _target_label FROM public.wsf_centres WHERE id = _req.wsf_centre_id;
    _target_label := COALESCE(_target_label, 'Home Cell');
  END IF;

  -- Mark approved
  UPDATE public.unit_join_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  -- Audit log
  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), _req.tenant_id, 'join_request_approve', 'unit_join_requests', p_request_id::text,
    jsonb_build_object(
      'member_id', _req.member_id,
      'request_type', _req.request_type,
      'target', _target_label
    )
  );

  -- Notify member
  SELECT user_id INTO _member_user_id FROM public.members WHERE id = _req.member_id;
  IF _member_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    VALUES (
      _member_user_id, _req.tenant_id,
      'Join Request Approved',
      'Your request to join ' || _target_label || ' has been approved.',
      'general', p_request_id::text, 'unit_join_request'
    );
  END IF;
END;
$$;

-- 5. Decline function
CREATE OR REPLACE FUNCTION public.decline_join_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _is_admin boolean;
  _can_decline boolean;
  _member_user_id uuid;
  _target_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _req FROM public.unit_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  _is_admin := public.is_admin(auth.uid(), _req.tenant_id);
  _can_decline := _is_admin;

  IF NOT _can_decline AND _req.request_type = 'unit' THEN
    _can_decline := public.is_unit_leader_for_session(auth.uid(), _req.unit_name, _req.tenant_id);
  END IF;
  IF NOT _can_decline AND _req.request_type = 'home_cell' THEN
    _can_decline := public.is_home_cell_leader_for_centre(auth.uid(), _req.wsf_centre_id, _req.tenant_id);
  END IF;

  IF NOT _can_decline THEN
    RAISE EXCEPTION 'You are not authorized to decline this request';
  END IF;

  IF _req.request_type = 'unit' THEN
    _target_label := _req.unit_name;
  ELSE
    SELECT name INTO _target_label FROM public.wsf_centres WHERE id = _req.wsf_centre_id;
    _target_label := COALESCE(_target_label, 'Home Cell');
  END IF;

  UPDATE public.unit_join_requests
  SET status = 'declined',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      decline_reason = p_reason,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), _req.tenant_id, 'join_request_decline', 'unit_join_requests', p_request_id::text,
    jsonb_build_object(
      'member_id', _req.member_id,
      'request_type', _req.request_type,
      'target', _target_label,
      'reason', p_reason
    )
  );

  SELECT user_id INTO _member_user_id FROM public.members WHERE id = _req.member_id;
  IF _member_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, tenant_id, title, message, type, reference_id, reference_type)
    VALUES (
      _member_user_id, _req.tenant_id,
      'Join Request Declined',
      'Your request to join ' || _target_label || ' was declined.' || COALESCE(' Reason: ' || p_reason, ''),
      'general', p_request_id::text, 'unit_join_request'
    );
  END IF;
END;
$$;

-- 6. Counter for badge
CREATE OR REPLACE FUNCTION public.count_pending_join_requests_for_user(_user_id uuid, _tenant_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.unit_join_requests r
  WHERE r.tenant_id = _tenant_id
    AND r.status = 'pending'
    AND (
      public.is_admin(_user_id, _tenant_id)
      OR (r.request_type = 'unit' AND public.is_unit_leader_for_session(_user_id, r.unit_name, _tenant_id))
      OR (r.request_type = 'home_cell' AND public.is_home_cell_leader_for_centre(_user_id, r.wsf_centre_id, _tenant_id))
    );
$$;