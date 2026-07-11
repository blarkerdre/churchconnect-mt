-- Look up invitation details by token (callable by anon so the accept page can render pre-login)
CREATE OR REPLACE FUNCTION public.get_invitation_details(_token text)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  email text,
  role text,
  status text,
  expired boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.tenant_id,
    t.name,
    t.slug,
    i.email,
    i.role,
    i.status,
    (i.expires_at IS NOT NULL AND i.expires_at < now()) AS expired
  FROM public.tenant_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = _token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_details(text) TO anon, authenticated;

-- Accept invitation by token; supports email mismatch when the user chooses to accept with a different account
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation_by_token(
  _token text,
  _allow_email_mismatch boolean DEFAULT false
)
RETURNS TABLE (tenant_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  user_email text;
  t_slug text;
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

  IF lower(inv.email) <> lower(user_email) AND NOT _allow_email_mismatch THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (inv.tenant_id, auth.uid(), COALESCE(inv.role, 'member')::tenant_role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'member'::app_role, inv.tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  -- Link an existing member row in this tenant with the same email, if unlinked
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
$$;

GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation_by_token(text, boolean) TO authenticated;
