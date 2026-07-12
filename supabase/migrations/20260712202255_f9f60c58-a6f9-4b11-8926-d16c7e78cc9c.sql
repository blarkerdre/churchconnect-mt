
-- 1. lecturer_qc_checks: scope to authenticated
DROP POLICY IF EXISTS "Tenant admins can view QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can insert QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can update QC checks" ON public.lecturer_qc_checks;
DROP POLICY IF EXISTS "Tenant admins can delete QC checks" ON public.lecturer_qc_checks;

CREATE POLICY "Tenant admins can view QC checks"
ON public.lecturer_qc_checks FOR SELECT TO authenticated
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

CREATE POLICY "Tenant admins can insert QC checks"
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
  )
);

CREATE POLICY "Tenant admins can update QC checks"
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
  )
);

CREATE POLICY "Tenant admins can delete QC checks"
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

-- 2. unit_task_comments: scope to authenticated
DROP POLICY IF EXISTS utc_select ON public.unit_task_comments;
DROP POLICY IF EXISTS utc_insert ON public.unit_task_comments;
DROP POLICY IF EXISTS utc_delete ON public.unit_task_comments;

CREATE POLICY utc_select
ON public.unit_task_comments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = unit_task_comments.tenant_id
      AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
  OR EXISTS (
    SELECT 1 FROM unit_tasks t
    WHERE t.id = unit_task_comments.task_id
      AND user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
  OR EXISTS (
    SELECT 1 FROM unit_task_assignments a
    WHERE a.task_id = unit_task_comments.task_id
      AND a.user_id = auth.uid()
  )
);

CREATE POLICY utc_insert
ON public.unit_task_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = unit_task_comments.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
    OR EXISTS (
      SELECT 1 FROM unit_tasks t
      WHERE t.id = unit_task_comments.task_id
        AND user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM unit_task_assignments a
      WHERE a.task_id = unit_task_comments.task_id
        AND a.user_id = auth.uid()
    )
  )
);

CREATE POLICY utc_delete
ON public.unit_task_comments FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = unit_task_comments.tenant_id
      AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
  )
  OR EXISTS (
    SELECT 1 FROM unit_tasks t
    WHERE t.id = unit_task_comments.task_id
      AND user_leads_unit(auth.uid(), t.unit_name, t.tenant_id)
  )
);

-- 3. Storage: profile_photos_read_same_tenant — restrict to authenticated and require
--    the owner's user id (from folder) and the caller to share the same specific tenant_id.
DROP POLICY IF EXISTS profile_photos_read_same_tenant ON storage.objects;

CREATE POLICY profile_photos_read_same_tenant
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1
        FROM tenant_memberships caller_tm
        JOIN tenant_memberships owner_tm
          ON owner_tm.tenant_id = caller_tm.tenant_id
        WHERE caller_tm.user_id = auth.uid()
          AND owner_tm.user_id::text = (storage.foldername(objects.name))[1]
          AND caller_tm.tenant_id = owner_tm.tenant_id
      )
    )
  )
);

-- 4. wofbi_application_forms: restrict public read to enabled forms only.
DROP POLICY IF EXISTS "Public can view application form config" ON public.wofbi_application_forms;

CREATE POLICY "Public can view enabled application form"
ON public.wofbi_application_forms FOR SELECT
TO anon, authenticated
USING (enabled = true);

-- Allow tenant admins to still see their own disabled/draft forms
CREATE POLICY "Tenant admins can view their application form"
ON public.wofbi_application_forms FOR SELECT
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role));
