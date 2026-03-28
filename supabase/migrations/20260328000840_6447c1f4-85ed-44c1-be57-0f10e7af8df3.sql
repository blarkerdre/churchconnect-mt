
-- Update handle_new_user to also resolve tenant from user metadata (for direct signups from tenant auth pages)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _inv_id uuid;
  _inv_role text;
  _slug text;
BEGIN
  -- Try to resolve tenant from a pending invitation
  SELECT tenant_id, id, role INTO _tenant_id, _inv_id, _inv_role
  FROM public.tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Fallback: resolve tenant from user metadata (tenant_slug passed during signup)
  IF _tenant_id IS NULL THEN
    _slug := NEW.raw_user_meta_data->>'tenant_slug';
    IF _slug IS NOT NULL AND _slug != '' THEN
      SELECT id INTO _tenant_id
      FROM public.tenants
      WHERE slug = _slug AND is_archived IS NOT TRUE
      LIMIT 1;
    END IF;
  END IF;

  -- Create profile
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

  -- Create tenant access if we resolved a tenant
  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
    VALUES (NEW.id, _tenant_id, COALESCE(_inv_role, 'member'))
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'member', _tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

    -- Mark invitation as accepted if there was one
    IF _inv_id IS NOT NULL THEN
      UPDATE public.tenant_invitations
      SET status = 'accepted'
      WHERE id = _inv_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
