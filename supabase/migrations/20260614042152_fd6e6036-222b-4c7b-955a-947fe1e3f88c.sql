
-- Fix 1: tighten call_log INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert call logs" ON public.call_log;
CREATE POLICY "Authenticated users can insert call logs"
ON public.call_log
FOR INSERT
TO authenticated
WITH CHECK (
  caller_id = auth.uid()
  AND user_belongs_to_tenant(auth.uid(), tenant_id)
  AND (
    member_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = call_log.member_id
        AND m.tenant_id = call_log.tenant_id
    )
  )
);

-- Fix 2: tenant-aware certificate read policy
DROP POLICY IF EXISTS "Members can read own certificates" ON storage.objects;
CREATE POLICY "Members can read own certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'church-documents'
  AND (storage.foldername(name))[2] = 'certificates'
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND (storage.foldername(objects.name))[3] = m.id::text
      AND m.tenant_id::text = (storage.foldername(objects.name))[1]
  )
);
