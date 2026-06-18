
-- Fix infinite recursion between children <-> child_guardians policies
-- Root cause: children policies query child_guardians, and child_guardians
-- policies query children, producing recursive policy evaluation.

-- 1. SECURITY DEFINER helpers (bypass RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_child_co_parent(_user_id uuid, _child_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.child_guardians cg
    JOIN public.members m ON m.id = cg.member_id
    WHERE cg.child_id = _child_id
      AND cg.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_child_primary_guardian(_user_id uuid, _child_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = _child_id
      AND c.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.tenant_id = _tenant_id
  );
$$;

-- 2. Rebuild children policies using helpers (no direct cross-table EXISTS)
DROP POLICY IF EXISTS "Co-parents read linked children" ON public.children;
DROP POLICY IF EXISTS "Co-parents update linked children" ON public.children;
DROP POLICY IF EXISTS "Co-parents delete linked children" ON public.children;
DROP POLICY IF EXISTS "Guardians read their own children" ON public.children;
DROP POLICY IF EXISTS "Guardians update own children" ON public.children;
DROP POLICY IF EXISTS "Guardians delete own children" ON public.children;
DROP POLICY IF EXISTS "Guardians manage own children" ON public.children;

CREATE POLICY "Children select access" ON public.children
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
);

CREATE POLICY "Children insert by guardian or admin" ON public.children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = primary_guardian_member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = children.tenant_id
  )
);

CREATE POLICY "Children update by guardian or admin" ON public.children
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
)
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Children delete by guardian or admin" ON public.children
FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), id, tenant_id)
);

-- 3. Rebuild child_guardians policies without joining children directly
DROP POLICY IF EXISTS "Primary guardian manages list" ON public.child_guardians;
DROP POLICY IF EXISTS "Read guardians of accessible children" ON public.child_guardians;

CREATE POLICY "Child guardians select" ON public.child_guardians
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
);

CREATE POLICY "Child guardians manage" ON public.child_guardians
FOR ALL TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
);

-- 4. Rebuild child_checkins SELECT policy to avoid joining children
DROP POLICY IF EXISTS "Read checkins: guardian, workers, admin" ON public.child_checkins;

CREATE POLICY "Child checkins select" ON public.child_checkins
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_reports_officer(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
);

-- 5. Ensure Data API grants exist
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_guardians TO authenticated;
GRANT ALL ON public.child_guardians TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_checkins TO authenticated;
GRANT ALL ON public.child_checkins TO service_role;
