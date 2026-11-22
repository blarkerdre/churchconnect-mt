-- 1) Course applications: people applying for themselves can only submit a new (unreviewed) application.
DROP POLICY IF EXISTS "Applicants and admins can insert applications" ON public.wofbi_applications;
CREATE POLICY "Applicants and admins can insert applications"
ON public.wofbi_applications
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    public.is_tenant_admin(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      member_id IS NOT NULL
      AND status = 'submitted'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = wofbi_applications.member_id
          AND m.user_id = auth.uid()
          AND m.tenant_id = wofbi_applications.tenant_id
      )
    )
  )
);

-- 2) Church subscription, plan, limits, archive state and super-admin module switches are super-admin only.
CREATE OR REPLACE FUNCTION public.tenants_guard_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
       OR NEW.pricing_plan_id IS DISTINCT FROM OLD.pricing_plan_id
       OR NEW.member_limit IS DISTINCT FROM OLD.member_limit
       OR NEW.storage_limit_mb IS DISTINCT FROM OLD.storage_limit_mb
       OR NEW.billing_currency IS DISTINCT FROM OLD.billing_currency
       OR NEW.is_archived IS DISTINCT FROM OLD.is_archived
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
       OR NEW.certificate_code IS DISTINCT FROM OLD.certificate_code
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Only platform super-admins can change a church''s subscription, plan or limits';
    END IF;
    -- Module on/off switches are set by super-admins; keep them whatever settings a church admin saves.
    IF (NEW.settings -> 'disabled_features') IS DISTINCT FROM (OLD.settings -> 'disabled_features') THEN
      IF OLD.settings ? 'disabled_features' THEN
        NEW.settings := jsonb_set(coalesce(NEW.settings, '{}'::jsonb), '{disabled_features}', OLD.settings -> 'disabled_features');
      ELSE
        NEW.settings := coalesce(NEW.settings, '{}'::jsonb) - 'disabled_features';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.tenants_guard_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenants_guard_subscription ON public.tenants;
CREATE TRIGGER trg_tenants_guard_subscription
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenants_guard_subscription();

-- 3) Pastoral care cases can only be assigned to pastoral staff: church admins, super-admins,
--    Pastoral Care unit leaders, or members of the Pastoral Care unit.
CREATE OR REPLACE FUNCTION public.enforce_pastoral_assignee_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND current_user IN ('authenticated','anon')
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
     AND NOT (
       public.has_role(NEW.assigned_to, 'super_admin'::app_role)
       OR public.is_admin(NEW.assigned_to, NEW.tenant_id)
       OR EXISTS (
         SELECT 1 FROM public.unit_leader_assignments ula
         WHERE ula.user_id = NEW.assigned_to
           AND ula.tenant_id = NEW.tenant_id
           AND lower(replace(ula.unit_name, ' ', '')) = 'pastoralcare'
       )
       OR EXISTS (
         SELECT 1 FROM public.members m
         WHERE m.user_id = NEW.assigned_to
           AND m.tenant_id = NEW.tenant_id
           AND lower(replace(coalesce(m.church_unit, ''), ' ', '')) LIKE '%pastoralcare%'
       )
     ) THEN
    RAISE EXCEPTION 'Pastoral care cases can only be assigned to the Pastoral Care team or a church admin';
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.enforce_pastoral_assignee_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pastoral_care_assignee_role ON public.pastoral_care;
CREATE TRIGGER trg_pastoral_care_assignee_role
BEFORE INSERT OR UPDATE ON public.pastoral_care
FOR EACH ROW EXECUTE FUNCTION public.enforce_pastoral_assignee_role();