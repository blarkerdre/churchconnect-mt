
-- 1. child_pickup_delegations: scope worker access to children currently checked in
DROP POLICY IF EXISTS "Read delegations for own children or workers" ON public.child_pickup_delegations;

CREATE POLICY "Read delegations for own children or workers"
ON public.child_pickup_delegations
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = child_pickup_delegations.issued_by_member_id
      AND m.user_id = auth.uid()
  ))
  OR is_admin(auth.uid(), tenant_id)
  OR (
    is_children_church_member(auth.uid(), tenant_id)
    AND valid_on = CURRENT_DATE
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.child_checkins ck
      WHERE ck.child_id = child_pickup_delegations.child_id
        AND ck.tenant_id = child_pickup_delegations.tenant_id
        AND ck.service_date = CURRENT_DATE
        AND ck.pickup_at IS NULL
    )
  )
);

-- 2. exam_questions: remove unit_leader write access (keep SELECT via existing policy)
DROP POLICY IF EXISTS "Admins/leaders can manage exam questions" ON public.exam_questions;

CREATE POLICY "Admins can manage exam questions"
ON public.exam_questions
FOR ALL
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- 3. wofbi_application_forms: remove blanket public read; expose via SECURITY DEFINER RPC scoped to one tenant
DROP POLICY IF EXISTS "Public can view enabled application form" ON public.wofbi_application_forms;

CREATE OR REPLACE FUNCTION public.get_public_wofbi_application_form(_tenant_id uuid)
RETURNS TABLE (enabled boolean, title text, intro_text text, fields jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.enabled, f.title, f.intro_text, f.fields
  FROM public.wofbi_application_forms f
  WHERE f.tenant_id = _tenant_id
    AND f.enabled = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_wofbi_application_form(uuid) TO anon, authenticated;

-- 4. storage.objects profile_photos_read_restricted: don't trust storage.owner; rely on members table linkage
DROP POLICY IF EXISTS "profile_photos_read_restricted" ON storage.objects;

CREATE POLICY "profile_photos_read_restricted"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
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
