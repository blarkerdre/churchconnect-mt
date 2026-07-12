
-- wofbi_applications: applicant own-view must also match tenant membership
DROP POLICY IF EXISTS "Applicant member can view own application" ON public.wofbi_applications;
CREATE POLICY "Applicant member can view own application"
ON public.wofbi_applications
FOR SELECT
TO authenticated
USING (
  member_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = wofbi_applications.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = wofbi_applications.tenant_id
  )
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- consent_events: owner select scoped to tenant
DROP POLICY IF EXISTS consent_events_owner_select ON public.consent_events;
CREATE POLICY consent_events_owner_select
ON public.consent_events
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND (tenant_id IS NULL OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
);

-- erasure_requests: owner select scoped to tenant
DROP POLICY IF EXISTS erasure_requests_owner_select ON public.erasure_requests;
CREATE POLICY erasure_requests_owner_select
ON public.erasure_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
