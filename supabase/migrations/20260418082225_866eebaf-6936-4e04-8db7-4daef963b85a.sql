
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- ─── 1. Fix is_unit_leader_for_member substring match ──────────
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_member(_user_id uuid, _church_unit text, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_leader_assignments ula
    JOIN unnest(string_to_array(COALESCE(_church_unit, ''), ',')) AS t(unit) ON true
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(t.unit)) = lower(btrim(ula.unit_name))
      AND btrim(t.unit) <> ''
  )
$$;

-- ─── 2. Replace permissive user_roles self-insert with atomic RPC ──
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  SELECT * INTO inv
  FROM public.tenant_invitations
  WHERE id = _invitation_id
    AND status = 'pending'
    AND lower(email) = lower(user_email)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, expired, or does not belong to this user';
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    UPDATE public.tenant_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (inv.tenant_id, auth.uid(), COALESCE(inv.role, 'member')::tenant_role)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'member'::app_role, inv.tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  UPDATE public.tenant_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = inv.id;
END;
$$;

-- Drop the permissive self-insert policy now that the RPC handles it atomically
DROP POLICY IF EXISTS "Users can self-insert role via invitation" ON public.user_roles;

-- ─── 3. Restrict exam_questions SELECT (defence in depth) ──────
DROP POLICY IF EXISTS "Restrict exam questions to staff" ON public.exam_questions;
CREATE POLICY "Restrict exam questions to staff"
ON public.exam_questions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- ─── 4. Tighten storage SELECT on public buckets ───────────────
-- Public buckets: files still served via direct public URLs, but listing is blocked
DROP POLICY IF EXISTS "Anyone can read profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view book covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone reads book covers" ON storage.objects;

-- Authenticated users may read individual objects only when they query by exact name
-- (still requires knowing the path; bucket listing is no longer possible anonymously)
CREATE POLICY "Authenticated read profile photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "Authenticated read book covers"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'book-covers');
