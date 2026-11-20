CREATE OR REPLACE FUNCTION public.erasure_requests_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m_tenant uuid;
  m_user uuid;
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id, user_id INTO m_tenant, m_user
  FROM public.members WHERE id = NEW.member_id;

  IF NOT FOUND OR m_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Member does not belong to this church';
  END IF;

  -- Non-admin requesters may only target their own member record
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid(), NEW.tenant_id)
     AND m_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only request erasure of your own record';
  END IF;

  -- The subject account must match the member record when it is linked
  IF m_user IS NOT NULL AND NEW.user_id IS NOT NULL AND m_user <> NEW.user_id THEN
    RAISE EXCEPTION 'Member record does not match the requesting account';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.erasure_requests_member_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_erasure_requests_member_guard ON public.erasure_requests;
CREATE TRIGGER trg_erasure_requests_member_guard
BEFORE INSERT OR UPDATE OF member_id, tenant_id, user_id ON public.erasure_requests
FOR EACH ROW EXECUTE FUNCTION public.erasure_requests_member_guard();

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation_by_token(_token text, _allow_email_mismatch boolean DEFAULT false)
 RETURNS TABLE(tenant_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  user_email text;
  t_slug text;
BEGIN
  -- _allow_email_mismatch is retained only for signature compatibility and is ignored.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  SELECT * INTO inv
  FROM public.tenant_invitations
  WHERE token = _token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    UPDATE public.tenant_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (inv.tenant_id, auth.uid(), COALESCE(inv.role, 'member')::tenant_role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'member'::app_role, inv.tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  UPDATE public.members m
  SET user_id = auth.uid()
  WHERE m.tenant_id = inv.tenant_id
    AND m.user_id IS NULL
    AND lower(m.email) = lower(user_email);

  UPDATE public.tenant_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = inv.id;

  SELECT slug INTO t_slug FROM public.tenants WHERE id = inv.tenant_id;
  tenant_slug := t_slug;
  RETURN NEXT;
END;
$function$;