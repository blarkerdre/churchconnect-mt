
-- 1. Helper: ensure a church_unit row exists for a tenant
CREATE OR REPLACE FUNCTION public.ensure_church_unit(_tenant uuid, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tenant IS NULL OR _name IS NULL THEN RETURN; END IF;
  INSERT INTO public.church_units (tenant_id, name, is_active)
  VALUES (_tenant, _name, true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

-- 2. Helper: add a unit to members.church_unit (case-insensitive, preserves others)
CREATE OR REPLACE FUNCTION public.add_member_unit(_member uuid, _unit text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val text;
  parts text[];
  found boolean := false;
  p text;
BEGIN
  IF _member IS NULL OR _unit IS NULL OR btrim(_unit) = '' THEN RETURN; END IF;
  SELECT church_unit INTO current_val FROM public.members WHERE id = _member;
  IF current_val IS NULL OR btrim(current_val) = '' THEN
    UPDATE public.members SET church_unit = _unit WHERE id = _member;
    RETURN;
  END IF;
  parts := string_to_array(current_val, ',');
  FOREACH p IN ARRAY parts LOOP
    IF lower(btrim(p)) = lower(btrim(_unit)) THEN
      found := true; EXIT;
    END IF;
  END LOOP;
  IF NOT found THEN
    UPDATE public.members SET church_unit = current_val || ', ' || _unit WHERE id = _member;
  END IF;
END;
$$;

-- 3. Helper: remove a unit from members.church_unit (case-insensitive)
CREATE OR REPLACE FUNCTION public.remove_member_unit(_member uuid, _unit text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_val text;
  parts text[];
  keep text[] := ARRAY[]::text[];
  p text;
  new_val text;
BEGIN
  IF _member IS NULL OR _unit IS NULL THEN RETURN; END IF;
  SELECT church_unit INTO current_val FROM public.members WHERE id = _member;
  IF current_val IS NULL THEN RETURN; END IF;
  parts := string_to_array(current_val, ',');
  FOREACH p IN ARRAY parts LOOP
    IF lower(btrim(p)) <> lower(btrim(_unit)) AND btrim(p) <> '' THEN
      keep := array_append(keep, btrim(p));
    END IF;
  END LOOP;
  new_val := NULLIF(array_to_string(keep, ', '), '');
  UPDATE public.members SET church_unit = new_val WHERE id = _member;
END;
$$;

-- 4. Trigger fn: role -> auto add/remove church unit
CREATE OR REPLACE FUNCTION public.sync_role_church_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit_name text;
  target_member uuid;
  target_tenant uuid;
  target_user uuid;
  target_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_user := NEW.user_id; target_tenant := NEW.tenant_id; target_role := NEW.role::text;
  ELSE
    target_user := OLD.user_id; target_tenant := OLD.tenant_id; target_role := OLD.role::text;
  END IF;

  IF target_role = 'unit_leader' THEN unit_name := 'Unit Leader';
  ELSIF target_role = 'wsf_leader' THEN unit_name := 'Home Cell Leader';
  ELSE RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO target_member FROM public.members
   WHERE user_id = target_user AND (tenant_id IS NOT DISTINCT FROM target_tenant)
   LIMIT 1;
  IF target_member IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.ensure_church_unit(target_tenant, unit_name);
    PERFORM public.add_member_unit(target_member, unit_name);
  ELSE
    PERFORM public.remove_member_unit(target_member, unit_name);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_church_unit_ins ON public.user_roles;
DROP TRIGGER IF EXISTS trg_sync_role_church_unit_del ON public.user_roles;
CREATE TRIGGER trg_sync_role_church_unit_ins
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_church_unit();
CREATE TRIGGER trg_sync_role_church_unit_del
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_church_unit();

-- 5. Trigger fn: wsf_centres.host_member_id -> auto add/remove House Provider unit
CREATE OR REPLACE FUNCTION public.sync_house_provider_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_host uuid;
  new_host uuid;
  target_tenant uuid;
  still_hosts boolean;
BEGIN
  old_host := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.host_member_id ELSE NULL END;
  new_host := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.host_member_id ELSE NULL END;
  target_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);

  IF old_host IS NOT DISTINCT FROM new_host AND TG_OP = 'UPDATE' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF new_host IS NOT NULL THEN
    PERFORM public.ensure_church_unit(target_tenant, 'House Provider');
    PERFORM public.add_member_unit(new_host, 'House Provider');
  END IF;

  IF old_host IS NOT NULL AND old_host IS DISTINCT FROM new_host THEN
    SELECT EXISTS (
      SELECT 1 FROM public.wsf_centres
       WHERE host_member_id = old_host
         AND (tenant_id IS NOT DISTINCT FROM target_tenant)
         AND id <> COALESCE(OLD.id, NEW.id)
         AND COALESCE(is_active, true) = true
    ) INTO still_hosts;
    IF NOT still_hosts THEN
      PERFORM public.remove_member_unit(old_host, 'House Provider');
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_house_provider_unit ON public.wsf_centres;
CREATE TRIGGER trg_sync_house_provider_unit
  AFTER INSERT OR UPDATE OF host_member_id, is_active OR DELETE ON public.wsf_centres
  FOR EACH ROW EXECUTE FUNCTION public.sync_house_provider_unit();

-- 6. Seed the three units for every existing tenant
INSERT INTO public.church_units (tenant_id, name, is_active)
SELECT t.id, u.name, true
FROM public.tenants t
CROSS JOIN (VALUES ('Unit Leader'), ('Home Cell Leader'), ('House Provider')) AS u(name)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 7. Backfill: unit_leader / wsf_leader role holders
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ur.user_id, ur.tenant_id, ur.role::text AS role
    FROM public.user_roles ur
    WHERE ur.role IN ('unit_leader','wsf_leader')
  LOOP
    PERFORM public.add_member_unit(
      (SELECT id FROM public.members WHERE user_id = r.user_id AND tenant_id IS NOT DISTINCT FROM r.tenant_id LIMIT 1),
      CASE WHEN r.role = 'unit_leader' THEN 'Unit Leader' ELSE 'Home Cell Leader' END
    );
  END LOOP;
END $$;

-- 8. Backfill: existing House Providers
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT host_member_id FROM public.wsf_centres WHERE host_member_id IS NOT NULL LOOP
    PERFORM public.add_member_unit(r.host_member_id, 'House Provider');
  END LOOP;
END $$;
