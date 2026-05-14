
-- 1. followup_scheduled_messages: drop redundant creator-wide policy that exposed PII
DROP POLICY IF EXISTS "Assigned users can manage own followup messages" ON public.followup_scheduled_messages;

-- 2. tenant-pwa-icons: restrict writes to tenant admins
DROP POLICY IF EXISTS "Tenant admins write pwa icons" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins update pwa icons" ON storage.objects;
DROP POLICY IF EXISTS "Tenant admins delete pwa icons" ON storage.objects;

CREATE POLICY "Tenant admins write pwa icons"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-pwa-icons'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant admins update pwa icons"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-pwa-icons'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant admins delete pwa icons"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-pwa-icons'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3. Drop unscoped is_admin(uuid) overload — cross-tenant escalation footgun
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 4. wsf_attendance_reports: restrict SELECT to admins/leaders/own-centre WSF leader
DROP POLICY IF EXISTS "Authenticated can view wsf reports" ON public.wsf_attendance_reports;

CREATE POLICY "Authorized can view wsf reports"
ON public.wsf_attendance_reports FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  OR public.is_home_cell_leader_for_centre(auth.uid(), centre_id, tenant_id)
);

-- 5. church-documents: make bucket private (signed URLs required for reads)
UPDATE storage.buckets SET public = false WHERE id = 'church-documents';

-- 6. exam_titles: remove over-broad anon SELECT, add tenant-scoped public RPC
DROP POLICY IF EXISTS "Anon can view active courses with open registration" ON public.exam_titles;

CREATE OR REPLACE FUNCTION public.get_public_courses_for_tenant(_tenant_id uuid)
RETURNS TABLE(id uuid, name text, description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.description
  FROM public.exam_titles t
  WHERE t.tenant_id = _tenant_id
    AND t.is_active = true
    AND t.registration_open = true
  ORDER BY t.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_courses_for_tenant(uuid) TO anon, authenticated;
