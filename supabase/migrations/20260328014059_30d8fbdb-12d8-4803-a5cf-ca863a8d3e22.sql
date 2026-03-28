CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _inv_id uuid;
  _inv_role text;
  _slug text;
BEGIN
  SELECT tenant_id, id, role INTO _tenant_id, _inv_id, _inv_role
  FROM public.tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    _slug := NEW.raw_user_meta_data->>'tenant_slug';
    IF _slug IS NOT NULL AND _slug != '' THEN
      SELECT id INTO _tenant_id
      FROM public.tenants
      WHERE slug = _slug AND is_archived IS NOT TRUE
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    _tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
    VALUES (NEW.id, _tenant_id, COALESCE(_inv_role, 'member')::tenant_role)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'member', _tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

    IF _inv_id IS NOT NULL THEN
      UPDATE public.tenant_invitations
      SET status = 'accepted'
      WHERE id = _inv_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;