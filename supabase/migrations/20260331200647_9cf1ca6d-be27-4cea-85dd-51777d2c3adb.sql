
-- 1. Enhance handle_new_user() to auto-link unlinked member records
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
  -- 1. Resolve tenant from metadata slug FIRST (most authoritative)
  _slug := NEW.raw_user_meta_data->>'tenant_slug';
  IF _slug IS NOT NULL AND _slug != '' THEN
    SELECT id INTO _tenant_id
    FROM public.tenants
    WHERE slug = _slug AND is_archived IS NOT TRUE
    LIMIT 1;
  END IF;

  -- 2. Check for pending invitation — but only accept if it matches the
  --    already-resolved tenant, OR if no slug was provided (backwards compat)
  SELECT ti.tenant_id, ti.id, ti.role INTO _tenant_id, _inv_id, _inv_role
  FROM public.tenant_invitations ti
  WHERE lower(ti.email) = lower(NEW.email)
    AND ti.status = 'pending'
    AND (_tenant_id IS NULL OR ti.tenant_id = _tenant_id)
  ORDER BY ti.created_at DESC
  LIMIT 1;

  -- 3. If still no tenant and no slug was provided, fall back to invitation
  --    from any tenant (original behaviour for organic signups)
  IF _tenant_id IS NULL AND (_slug IS NULL OR _slug = '') THEN
    SELECT ti.tenant_id, ti.id, ti.role INTO _tenant_id, _inv_id, _inv_role
    FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower(NEW.email)
      AND ti.status = 'pending'
    ORDER BY ti.created_at DESC
    LIMIT 1;
  END IF;

  -- 4. Final fallback: use WCI Cardiff as default tenant
  IF _tenant_id IS NULL THEN
    _tenant_id := '95e53cc3-4569-4dd3-a4ad-3489593dce81'::uuid;
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

    -- Auto-link unlinked member record matching email + tenant
    UPDATE public.members
    SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND tenant_id = _tenant_id
      AND user_id IS NULL
      AND id = (
        SELECT id FROM public.members
        WHERE lower(email) = lower(NEW.email)
          AND tenant_id = _tenant_id
          AND user_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Backfill: link existing unlinked members where a profile exists with matching email + tenant
UPDATE members m
SET user_id = p.user_id
FROM profiles p
WHERE lower(m.email) = lower(p.email)
  AND m.tenant_id = p.tenant_id
  AND m.user_id IS NULL
  AND p.user_id IS NOT NULL;
