
-- 1. Tenant API keys: store only hash + prefix (no plaintext)
ALTER TABLE public.tenant_api_keys
  ADD COLUMN IF NOT EXISTS key_hash text,
  ADD COLUMN IF NOT EXISTS key_prefix text;

ALTER TABLE public.tenant_api_keys ALTER COLUMN api_key DROP NOT NULL;
ALTER TABLE public.tenant_api_keys ALTER COLUMN api_key DROP DEFAULT;
ALTER TABLE public.tenant_api_keys DROP COLUMN api_key;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_keys_key_hash_idx ON public.tenant_api_keys(key_hash);

-- 2. Exam answer keys: explicit RESTRICTIVE policy blocking non-admins
DROP POLICY IF EXISTS "Restrict exam answers to admins" ON public.exam_question_answers;
CREATE POLICY "Restrict exam answers to admins"
  ON public.exam_question_answers
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3. Profile photos bucket: scope read to caller's own folder OR shared tenant
DROP POLICY IF EXISTS "Authenticated read profile photos" ON storage.objects;
CREATE POLICY "Authenticated read profile photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
    )
  );
