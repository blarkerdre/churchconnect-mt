
-- 1. Add source tag to members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS source TEXT;

-- 2. Walk-in claim invites
CREATE TABLE IF NOT EXISTS public.member_claim_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  claimed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_claim_invites_tenant ON public.member_claim_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_member_claim_invites_token  ON public.member_claim_invites(token);

GRANT SELECT, INSERT, UPDATE ON public.member_claim_invites TO authenticated;
GRANT ALL ON public.member_claim_invites TO service_role;

ALTER TABLE public.member_claim_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read claim invites"
  ON public.member_claim_invites FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members create claim invites"
  ON public.member_claim_invites FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members update claim invites"
  ON public.member_claim_invites FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- 3. Walk-in family registration RPC (worker bypasses guardian-only INSERT policy on children)
CREATE OR REPLACE FUNCTION public.register_walkin_family(
  _tenant_id UUID,
  _parent JSONB,
  _children JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_child JSONB;
  v_child_id UUID;
  v_children_out JSONB := '[]'::jsonb;
  v_parent_first TEXT := NULLIF(trim(_parent->>'first_name'), '');
  v_parent_last  TEXT := NULLIF(trim(_parent->>'last_name'), '');
BEGIN
  IF NOT public.user_has_tenant_access(_tenant_id) THEN
    RAISE EXCEPTION 'Not authorised for this tenant';
  END IF;
  IF v_parent_first IS NULL OR v_parent_last IS NULL THEN
    RAISE EXCEPTION 'Parent first and last name are required';
  END IF;
  IF jsonb_typeof(_children) <> 'array' OR jsonb_array_length(_children) = 0 THEN
    RAISE EXCEPTION 'At least one child is required';
  END IF;

  INSERT INTO public.members (
    tenant_id, first_name, last_name, phone, email,
    membership_status, source, notes
  ) VALUES (
    _tenant_id,
    v_parent_first,
    v_parent_last,
    NULLIF(trim(_parent->>'phone'), ''),
    NULLIF(trim(_parent->>'email'), ''),
    'Visitor'::membership_status,
    'children_church_walkin',
    NULLIF(trim(_parent->>'notes'), '')
  ) RETURNING id INTO v_member_id;

  FOR v_child IN SELECT * FROM jsonb_array_elements(_children) LOOP
    INSERT INTO public.children (
      tenant_id, primary_guardian_member_id,
      first_name, last_name,
      date_of_birth, gender, age_group,
      allergies, medical_notes, notes
    ) VALUES (
      _tenant_id, v_member_id,
      NULLIF(trim(v_child->>'first_name'), ''),
      NULLIF(trim(v_child->>'last_name'), ''),
      NULLIF(v_child->>'date_of_birth','')::date,
      NULLIF(v_child->>'gender',''),
      NULLIF(v_child->>'age_group',''),
      NULLIF(trim(v_child->>'allergies'), ''),
      NULLIF(trim(v_child->>'medical_notes'), ''),
      NULLIF(trim(v_child->>'notes'), '')
    ) RETURNING id INTO v_child_id;

    v_children_out := v_children_out || jsonb_build_object(
      'id', v_child_id,
      'first_name', v_child->>'first_name',
      'last_name', v_child->>'last_name',
      'age_group', v_child->>'age_group',
      'allergies', v_child->>'allergies'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'children', v_children_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_walkin_family(UUID, JSONB, JSONB) TO authenticated;

-- 4. Claim invite RPC: links the signed-in user to the existing walk-in member.
CREATE OR REPLACE FUNCTION public.claim_member(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.member_claim_invites;
  v_uid UUID := auth.uid();
  v_existing UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to claim';
  END IF;

  SELECT * INTO v_invite
  FROM public.member_claim_invites
  WHERE token = _token
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid claim token';
  END IF;
  IF v_invite.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  -- If the auth user already has a member in this tenant, do not duplicate.
  SELECT id INTO v_existing
  FROM public.members
  WHERE user_id = v_uid AND tenant_id = v_invite.tenant_id
  LIMIT 1;

  IF v_existing IS NOT NULL AND v_existing <> v_invite.member_id THEN
    RAISE EXCEPTION 'You already have a profile in this church';
  END IF;

  UPDATE public.members
     SET user_id = v_uid,
         source = 'claimed',
         updated_at = now()
   WHERE id = v_invite.member_id
     AND tenant_id = v_invite.tenant_id
     AND (user_id IS NULL OR user_id = v_uid);

  UPDATE public.member_claim_invites
     SET claimed_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'member_id', v_invite.member_id,
    'tenant_id', v_invite.tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_member(TEXT) TO authenticated;
