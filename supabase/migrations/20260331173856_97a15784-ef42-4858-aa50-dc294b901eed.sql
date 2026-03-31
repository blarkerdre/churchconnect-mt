
-- 1. Update handle_new_user to fall back to DEFAULT_TENANT_ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 4. Final fallback: use DEFAULT_TENANT_ID so every user gets a membership
  IF _tenant_id IS NULL THEN
    _tenant_id := 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'::uuid;
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
$function$;

-- 2. Backfill missing tenant_memberships for users who have member records
INSERT INTO tenant_memberships (user_id, tenant_id, role)
SELECT DISTINCT p.user_id, m.tenant_id, 'member'::tenant_role
FROM profiles p
JOIN members m ON m.user_id = p.user_id
WHERE m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = p.user_id AND tm.tenant_id = m.tenant_id
  );

-- 3. Backfill missing user_roles
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT DISTINCT p.user_id, 'member'::app_role, m.tenant_id
FROM profiles p
JOIN members m ON m.user_id = p.user_id
WHERE m.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'member' AND ur.tenant_id = m.tenant_id
  );

-- 4. Fix null tenant_id on profiles
UPDATE profiles p
SET tenant_id = m.tenant_id
FROM members m
WHERE m.user_id = p.user_id AND p.tenant_id IS NULL AND m.tenant_id IS NOT NULL;
