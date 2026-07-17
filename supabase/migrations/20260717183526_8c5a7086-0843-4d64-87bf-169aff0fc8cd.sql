
-- 1) child_checkins: block non-admin from arbitrary pickup edits
CREATE OR REPLACE FUNCTION public.enforce_child_checkin_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin'::app_role, NEW.tenant_id)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- If pickup-related fields are being changed, require caller is the pickup worker
  IF (COALESCE(NEW.pickup_adult_member_id::text,'') IS DISTINCT FROM COALESCE(OLD.pickup_adult_member_id::text,''))
     OR (COALESCE(NEW.pickup_worker_user_id::text,'') IS DISTINCT FROM COALESCE(OLD.pickup_worker_user_id::text,''))
     OR (COALESCE(NEW.override_reason,'') IS DISTINCT FROM COALESCE(OLD.override_reason,''))
     OR (COALESCE(NEW.pickup_delegation_id::text,'') IS DISTINCT FROM COALESCE(OLD.pickup_delegation_id::text,''))
     OR (COALESCE(NEW.pickup_method,'') IS DISTINCT FROM COALESCE(OLD.pickup_method,''))
     OR (NEW.pickup_at IS DISTINCT FROM OLD.pickup_at) THEN
    IF NEW.pickup_worker_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the pickup worker or an admin can modify pickup details';
    END IF;
  END IF;

  -- Prevent workers from moving records across tenants or children
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.child_id IS DISTINCT FROM OLD.child_id
     OR NEW.dropoff_worker_user_id IS DISTINCT FROM OLD.dropoff_worker_user_id
     OR NEW.dropoff_parent_member_id IS DISTINCT FROM OLD.dropoff_parent_member_id
     OR NEW.dropoff_at IS DISTINCT FROM OLD.dropoff_at
     OR NEW.service_date IS DISTINCT FROM OLD.service_date THEN
    RAISE EXCEPTION 'Only admins can modify drop-off/tenant fields on a check-in';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_child_checkin_update ON public.child_checkins;
CREATE TRIGGER trg_enforce_child_checkin_update
BEFORE UPDATE ON public.child_checkins
FOR EACH ROW EXECUTE FUNCTION public.enforce_child_checkin_update();

-- 2) unit_join_requests: restrict cancel policy to pending rows and forbid other column changes
DROP POLICY IF EXISTS "Members cancel own pending requests" ON public.unit_join_requests;
CREATE POLICY "Members cancel own pending requests"
ON public.unit_join_requests
FOR UPDATE
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = unit_join_requests.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = unit_join_requests.tenant_id
  )
)
WITH CHECK (
  status = 'cancelled'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = unit_join_requests.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = unit_join_requests.tenant_id
  )
);

CREATE OR REPLACE FUNCTION public.enforce_unit_join_request_member_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_member_owner boolean;
BEGIN
  -- Skip enforcement for admins/super admins
  IF public.has_role(auth.uid(), 'admin'::app_role, OLD.tenant_id)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = OLD.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = OLD.tenant_id
  ) INTO is_member_owner;

  IF is_member_owner THEN
    -- Members can ONLY flip status to 'cancelled'; every other column must be unchanged
    IF NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Members can only cancel their join request';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.member_id IS DISTINCT FROM OLD.member_id
       OR COALESCE(NEW.unit_name,'') IS DISTINCT FROM COALESCE(OLD.unit_name,'')
       OR COALESCE(NEW.wsf_centre_id::text,'') IS DISTINCT FROM COALESCE(OLD.wsf_centre_id::text,'')
       OR COALESCE(NEW.request_note,'') IS DISTINCT FROM COALESCE(OLD.request_note,'')
       OR COALESCE(NEW.reviewer_note,'') IS DISTINCT FROM COALESCE(OLD.reviewer_note,'')
       OR COALESCE(NEW.reviewed_by::text,'') IS DISTINCT FROM COALESCE(OLD.reviewed_by::text,'')
       OR COALESCE(NEW.reviewed_at::text,'') IS DISTINCT FROM COALESCE(OLD.reviewed_at::text,'') THEN
      RAISE EXCEPTION 'Members cannot modify fields other than status when cancelling';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unit_join_request_member_update ON public.unit_join_requests;
CREATE TRIGGER trg_enforce_unit_join_request_member_update
BEFORE UPDATE ON public.unit_join_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_join_request_member_update();

-- 3) Storage: remove fragile regex from profile_photos read policy; rely on exact match
DROP POLICY IF EXISTS profile_photos_read_restricted ON storage.objects;
CREATE POLICY profile_photos_read_restricted
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.members caller_m
      JOIN public.members owner_m ON owner_m.tenant_id = caller_m.tenant_id
      WHERE caller_m.user_id = auth.uid()
        AND (owner_m.user_id)::text = (storage.foldername(objects.name))[1]
        AND public.has_role(auth.uid(), 'admin'::app_role, caller_m.tenant_id)
    )
  )
);
