
-- Helper: Training Rep unit member check
CREATE OR REPLACE FUNCTION public.is_training_rep_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND m.church_unit IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM regexp_split_to_table(m.church_unit, ',') u
        WHERE lower(btrim(u)) = 'training rep'
      )
  );
$$;

-- Add qc_member_id column linking to members
ALTER TABLE public.lecturer_qc_checks
  ADD COLUMN IF NOT EXISTS qc_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- Unique QC per lecturer + subject (per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS lecturer_qc_checks_lecturer_subject_uniq
  ON public.lecturer_qc_checks (tenant_id, lecturer_id, exam_subject_id);

-- Rebuild RLS
DROP POLICY IF EXISTS "Tenant admins can view QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can insert QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can update QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can delete QC checks" ON public.lecturer_qc_checks;

-- SELECT: any tenant member or admin
CREATE POLICY "QC checks view"
ON public.lecturer_qc_checks FOR SELECT TO authenticated
USING (
  user_has_tenant_access(tenant_id)
);

-- INSERT: tenant admin, OR training rep member when wofbi_qc_enabled is on
CREATE POLICY "QC checks insert"
ON public.lecturer_qc_checks FOR INSERT TO authenticated
WITH CHECK (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_qc_checks.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
    OR (
      public.is_training_rep_member(auth.uid(), lecturer_qc_checks.tenant_id)
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = lecturer_qc_checks.tenant_id
          AND COALESCE((t.settings->>'wofbi_qc_enabled')::boolean, false) = true
      )
    )
  )
);

-- UPDATE: admin any, training rep own rows only
CREATE POLICY "QC checks update"
ON public.lecturer_qc_checks FOR UPDATE TO authenticated
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_qc_checks.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
    OR (
      public.is_training_rep_member(auth.uid(), lecturer_qc_checks.tenant_id)
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = lecturer_qc_checks.tenant_id
          AND COALESCE((t.settings->>'wofbi_qc_enabled')::boolean, false) = true
      )
    )
  )
)
WITH CHECK (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_qc_checks.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
    OR (
      public.is_training_rep_member(auth.uid(), lecturer_qc_checks.tenant_id)
      AND created_by = auth.uid()
    )
  )
);

-- DELETE: admins only
CREATE POLICY "QC checks delete"
ON public.lecturer_qc_checks FOR DELETE TO authenticated
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_qc_checks.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
  )
);
