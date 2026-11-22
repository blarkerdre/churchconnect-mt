CREATE OR REPLACE FUNCTION public.is_transport_staff(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.rpc_probe_blocked('is_transport_staff', _user_id) THEN RETURN false; END IF;
  RETURN public.has_role(_user_id, 'super_admin'::app_role)
    OR public.is_admin(_user_id, _tenant_id)
    OR EXISTS (SELECT 1 FROM public.unit_leader_assignments ula
      WHERE ula.user_id = _user_id AND ula.tenant_id = _tenant_id
        AND (ula.unit_name ILIKE '%transport%' OR ula.unit_name ILIKE '%kingdom chariot%'))
    OR EXISTS (SELECT 1 FROM public.members m
      WHERE m.user_id = _user_id AND m.tenant_id = _tenant_id
        AND (coalesce(m.church_unit,'') ILIKE '%transport%' OR coalesce(m.church_unit,'') ILIKE '%kingdom chariot%'));
END $$;
REVOKE EXECUTE ON FUNCTION public.is_transport_staff(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_transport_staff(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins/leaders can manage pastoral care" ON public.pastoral_care;
CREATE POLICY "Pastoral staff can manage pastoral care" ON public.pastoral_care FOR ALL TO authenticated
  USING (public.is_pastoral_staff(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.is_pastoral_staff(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "Authorized can view pastoral care" ON public.pastoral_care;
CREATE POLICY "Authorized can view pastoral care" ON public.pastoral_care FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id) AND (public.is_pastoral_staff(auth.uid(), tenant_id)
    OR auth.uid() = assigned_to OR auth.uid() = created_by));

DROP POLICY IF EXISTS "Admins/leaders can manage transport" ON public.transportation;
CREATE POLICY "Transport staff can manage transport" ON public.transportation FOR ALL TO authenticated
  USING (public.is_transport_staff(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.is_transport_staff(auth.uid(), tenant_id) AND public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS "View transport bookings" ON public.transportation;
CREATE POLICY "View transport bookings" ON public.transportation FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id) AND (auth.uid() = user_id OR auth.uid() = assigned_to
    OR auth.uid() = driver_user_id OR public.is_transport_staff(auth.uid(), tenant_id)));

CREATE OR REPLACE FUNCTION public.transportation_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  _uid uuid := auth.uid();
  _skip text[] := ARRAY['passenger_acknowledged_at','updated_at'];
  _own boolean;
BEGIN
  IF current_user NOT IN ('authenticated','anon')
     OR public.has_role(_uid, 'super_admin'::app_role)
     OR public.is_admin(_uid, NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  _own := (NEW.user_id = _uid) OR (TG_OP = 'UPDATE' AND OLD.user_id = _uid);

  IF public.is_transport_staff(_uid, NEW.tenant_id) AND NOT _own THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'Pending';
    NEW.assigned_to := NULL; NEW.assigned_at := NULL;
    NEW.driver_user_id := NULL; NEW.assigned_driver := NULL; NEW.driver_phone := NULL;
    NEW.auto_matched := false; NEW.pickup_order := NULL;
    NEW.notified_at := NULL; NEW.checked_in_at := NULL; NEW.picked_up_at := NULL; NEW.no_show_at := NULL;
    NEW.passenger_acknowledged_at := NULL; NEW.checkin_notes := NULL;
    RETURN NEW;
  END IF;

  IF NOT _own AND (_uid = OLD.assigned_to OR _uid = OLD.driver_user_id) THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.driver_user_id IS DISTINCT FROM OLD.driver_user_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.member_id IS DISTINCT FROM OLD.member_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Only transport leaders can change who handles or drives a booking';
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - _skip) IS DISTINCT FROM (to_jsonb(OLD) - _skip) THEN
    RAISE EXCEPTION 'You can only acknowledge your own booking; another transport leader must make changes';
  END IF;
  RETURN NEW;
END $function$;