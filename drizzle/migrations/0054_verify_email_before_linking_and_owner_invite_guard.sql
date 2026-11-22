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

  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, _tenant_id)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
        tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

  -- Until the mailbox is proven, the account only gets the plain member level.
  INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id,
          CASE WHEN _confirmed THEN COALESCE(_inv_role, 'member') ELSE 'member' END::tenant_role)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'member', _tenant_id)
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  IF _confirmed THEN
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
  END IF;

  RETURN NEW;
END;
$function$;

-- Runs once, when a new account's email address is confirmed.
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  tm record;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;

  -- Apply pending invitations for churches this account already joined at sign-up.
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

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_user_email_confirmed();

-- Only church owners and super-admins may hand out the owner or admin level.
CREATE OR REPLACE FUNCTION public.tenant_invitations_guard_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server code (already checks the inviter)
  END IF;
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.role, 'member') NOT IN ('member', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Invalid invitation role';
  END IF;
  IF COALESCE(NEW.role, 'member') IN ('owner', 'admin')
     AND (TG_OP = 'INSERT'
          OR NEW.role IS DISTINCT FROM OLD.role
          OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email))
     AND NOT EXISTS (
       SELECT 1 FROM public.tenant_memberships
       WHERE user_id = auth.uid() AND tenant_id = NEW.tenant_id AND role = 'owner'
     ) THEN
    RAISE EXCEPTION 'Only church owners or super-admins can invite owners or admins';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tenant_invitations_guard_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenant_invitations_guard_role ON public.tenant_invitations;
CREATE TRIGGER trg_tenant_invitations_guard_role
  BEFORE INSERT OR UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tenant_invitations_guard_role();