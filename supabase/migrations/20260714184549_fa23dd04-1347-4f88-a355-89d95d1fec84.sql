
DROP POLICY IF EXISTS "Authenticated users can insert call logs" ON public.call_log;
CREATE POLICY "Authenticated users can insert call logs"
ON public.call_log
FOR INSERT
TO authenticated
WITH CHECK (
  caller_id = auth.uid()
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    public.is_admin(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
    OR public.has_role(auth.uid(), 'wsf_leader'::app_role, tenant_id)
    OR public.has_role(auth.uid(), 'reports_officer'::app_role, tenant_id)
    OR (
      member_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = call_log.member_id
          AND m.tenant_id = call_log.tenant_id
          AND m.user_id = auth.uid()
      )
    )
    OR (
      reference_type = 'followup'
      AND reference_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.followups f
        WHERE f.id::text = call_log.reference_id
          AND f.tenant_id = call_log.tenant_id
          AND (f.assigned_to = auth.uid() OR f.created_by = auth.uid())
      )
    )
  )
);

-- =====================================================================
-- Children/child_guardians/child_checkins: scope worker access to today's check-ins
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_child_active_today(_user_id uuid, _child_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.child_checkins cc
    WHERE cc.child_id = _child_id
      AND cc.tenant_id = _tenant_id
      AND cc.service_date = CURRENT_DATE
      AND public.is_children_church_member(_user_id, _tenant_id)
  );
$$;

DROP POLICY IF EXISTS "Children select access" ON public.children;
CREATE POLICY "Children select access" ON public.children
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
  OR public.is_child_active_today(auth.uid(), id, tenant_id)
);

DROP POLICY IF EXISTS "Child guardians select" ON public.child_guardians;
CREATE POLICY "Child guardians select" ON public.child_guardians
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
  OR public.is_child_active_today(auth.uid(), child_id, tenant_id)
);

DROP POLICY IF EXISTS "Child checkins select" ON public.child_checkins;
CREATE POLICY "Child checkins select" ON public.child_checkins
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
  OR (
    public.is_children_church_member(auth.uid(), tenant_id)
    AND service_date = CURRENT_DATE
  )
);

-- =====================================================================
-- storage.objects profile-photos read: also require object owner to match folder UUID
-- =====================================================================
DROP POLICY IF EXISTS profile_photos_read_restricted ON storage.objects;
CREATE POLICY profile_photos_read_restricted
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND owner IS NOT NULL
      AND owner::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1
        FROM public.members caller_m
        JOIN public.members owner_m ON owner_m.tenant_id = caller_m.tenant_id
        WHERE caller_m.user_id = auth.uid()
          AND (owner_m.user_id)::text = (storage.foldername(objects.name))[1]
          AND has_role(auth.uid(), 'admin'::app_role, caller_m.tenant_id)
      )
    )
  )
);

-- =====================================================================
-- user_roles: explicit allow-list for tenant-admin role management + audit trigger
-- =====================================================================
DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON public.user_roles;
CREATE POLICY "Tenant admins can manage tenant roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  AND tenant_id IS NOT NULL
  AND role IN (
    'member'::app_role,
    'unit_leader'::app_role,
    'wsf_leader'::app_role,
    'reports_officer'::app_role
  )
)
WITH CHECK (
  is_admin(auth.uid(), tenant_id)
  AND tenant_id IS NOT NULL
  AND role IN (
    'member'::app_role,
    'unit_leader'::app_role,
    'wsf_leader'::app_role,
    'reports_officer'::app_role
  )
);

CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _action text;
  _target uuid;
  _tenant uuid;
  _role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'user_role_grant';
    _target := NEW.user_id;
    _tenant := NEW.tenant_id;
    _role   := NEW.role::text;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'user_role_update';
    _target := NEW.user_id;
    _tenant := NEW.tenant_id;
    _role   := NEW.role::text;
  ELSE
    _action := 'user_role_revoke';
    _target := OLD.user_id;
    _tenant := OLD.tenant_id;
    _role   := OLD.role::text;
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    _tenant,
    _actor,
    _action,
    'user_roles',
    _target::text,
    jsonb_build_object('role', _role, 'op', TG_OP)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_roles_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();
