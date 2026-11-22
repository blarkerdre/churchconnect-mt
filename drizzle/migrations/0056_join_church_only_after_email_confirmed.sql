CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid; _inv_tenant_id uuid; _inv_id uuid; _inv_role text; _slug text; _prov text;
  _confirmed boolean := NEW.email_confirmed_at IS NOT NULL;
BEGIN
  DELETE FROM public.tenant_owner_provisioning
   WHERE lower(email) = lower(NEW.email) AND expires_at > now()
   RETURNING email INTO _prov;
  IF _prov IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, NULL)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  _slug := NEW.raw_user_meta_data->>'tenant_slug';
  IF _slug IS NOT NULL AND _slug != '' THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = _slug AND is_archived IS NOT TRUE LIMIT 1;
  END IF;

  SELECT ti.tenant_id, ti.id, ti.role INTO _inv_tenant_id, _inv_id, _inv_role
  FROM public.tenant_invitations ti
  WHERE lower(ti.email) = lower(NEW.email) AND ti.status = 'pending'
    AND (ti.expires_at IS NULL OR ti.expires_at > now())
    AND (_tenant_id IS NULL OR ti.tenant_id = _tenant_id)
  ORDER BY ti.created_at DESC LIMIT 1;
  IF _inv_tenant_id IS NOT NULL THEN _tenant_id := _inv_tenant_id; END IF;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant could be resolved for this signup. Please use your church-specific registration link.';
  END IF;

  -- Remember which church they signed up for.
  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, _tenant_id)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
        tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

  -- Until the mailbox is proven, the account joins no church at all.
  -- handle_user_email_confirmed() adds the membership on confirmation.
  IF NOT _confirmed THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, COALESCE(_inv_role, 'member')::tenant_role)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'member', _tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  IF _inv_id IS NOT NULL THEN
    UPDATE public.tenant_invitations SET status = 'accepted', accepted_at = now() WHERE id = _inv_id;
  END IF;

  UPDATE public.members SET user_id = NEW.id
  WHERE id = (
    SELECT id FROM public.members
    WHERE lower(email) = lower(NEW.email) AND tenant_id = _tenant_id AND user_id IS NULL
    ORDER BY created_at DESC LIMIT 1
  )
  AND NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = NEW.id AND tenant_id = _tenant_id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  tm record;
  _signup_tenant uuid;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;

  -- Join the church they signed up for, now that the email is proven.
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = NEW.id) THEN
    SELECT p.tenant_id INTO _signup_tenant
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.tenant_id AND t.is_archived IS NOT TRUE
    WHERE p.user_id = NEW.id;

    IF _signup_tenant IS NOT NULL THEN
      INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
      VALUES (NEW.id, _signup_tenant, 'member'::tenant_role)
      ON CONFLICT (user_id, tenant_id) DO NOTHING;
      INSERT INTO public.user_roles (user_id, role, tenant_id)
      VALUES (NEW.id, 'member', _signup_tenant)
      ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
    END IF;
  END IF;

  -- Apply pending invitations for churches this account belongs to.
  FOR inv IN
    SELECT ti.id, ti.tenant_id, ti.role
    FROM public.tenant_invitations ti
    JOIN public.tenant_memberships m ON m.tenant_id = ti.tenant_id AND m.user_id = NEW.id
    WHERE lower(ti.email) = lower(NEW.email)
      AND ti.status = 'pending'
      AND (ti.expires_at IS NULL OR ti.expires_at > now())
    ORDER BY ti.created_at DESC
  LOOP
    UPDATE public.tenant_memberships
       SET role = COALESCE(inv.role, 'member')::tenant_role
     WHERE user_id = NEW.id AND tenant_id = inv.tenant_id AND role = 'member';
    UPDATE public.tenant_invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
  END LOOP;

  -- Link the matching unclaimed member record in each of those churches.
  FOR tm IN SELECT tenant_id FROM public.tenant_memberships WHERE user_id = NEW.id LOOP
    UPDATE public.members SET user_id = NEW.id
    WHERE id = (
      SELECT id FROM public.members
      WHERE lower(email) = lower(NEW.email) AND tenant_id = tm.tenant_id AND user_id IS NULL
      ORDER BY created_at DESC LIMIT 1
    )
    AND NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = NEW.id AND tenant_id = tm.tenant_id);
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_user_email_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;