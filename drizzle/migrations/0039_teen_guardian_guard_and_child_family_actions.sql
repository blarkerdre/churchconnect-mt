-- Teens / Pre-teens: only church admins can change the main parent or church.
CREATE OR REPLACE FUNCTION public.youth_guard_primary_guardian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.primary_guardian_member_id IS DISTINCT FROM OLD.primary_guardian_member_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    IF NOT (public.is_admin(auth.uid(), OLD.tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'Only church admins can change the main parent' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_teens_guard_primary_guardian ON public.teens;
CREATE TRIGGER trg_teens_guard_primary_guardian
  BEFORE UPDATE OF primary_guardian_member_id, tenant_id ON public.teens
  FOR EACH ROW EXECUTE FUNCTION public.youth_guard_primary_guardian();

DROP TRIGGER IF EXISTS trg_preteens_guard_primary_guardian ON public.preteens;
CREATE TRIGGER trg_preteens_guard_primary_guardian
  BEFORE UPDATE OF primary_guardian_member_id, tenant_id ON public.preteens
  FOR EACH ROW EXECUTE FUNCTION public.youth_guard_primary_guardian();

-- One-time pickup codes: main parent, a co-parent listed as "Parent" by the main parent, or a church admin.
DROP POLICY IF EXISTS "Guardian issues delegation" ON public.child_pickup_delegations;
CREATE POLICY "Guardian issues delegation" ON public.child_pickup_delegations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_tenant_access(tenant_id) AND (
      public.is_admin(auth.uid(), tenant_id)
      OR EXISTS (
        SELECT 1 FROM public.children c
        JOIN public.members m ON m.tenant_id = c.tenant_id
        WHERE c.id = child_pickup_delegations.child_id
          AND c.tenant_id = child_pickup_delegations.tenant_id
          AND m.id = child_pickup_delegations.issued_by_member_id
          AND m.user_id = auth.uid()
          AND (
            c.primary_guardian_member_id = m.id
            OR EXISTS (
              SELECT 1 FROM public.child_guardians cg
              WHERE cg.child_id = c.id AND cg.member_id = m.id
                AND cg.tenant_id = c.tenant_id AND cg.relationship = 'Parent'
            )
          )
      )
    )
  );

-- Removing a child's record: main parent or church admin only.
DROP POLICY IF EXISTS "Children delete by guardian or admin" ON public.children;
CREATE POLICY "Children delete by guardian or admin" ON public.children
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id)
    OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  );