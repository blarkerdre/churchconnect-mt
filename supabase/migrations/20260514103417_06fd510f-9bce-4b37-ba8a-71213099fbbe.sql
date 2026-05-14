
-- 1) Make the bucket private. Public URLs will stop working; the app now uses createSignedUrl.
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';

-- 2) Drop ALL existing policies that target profile-photos so we can re-define them cleanly.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND (
        pg_get_expr(p.polqual,  p.polrelid) ILIKE '%profile-photos%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%profile-photos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', r.polname);
  END LOOP;
END $$;

-- 3) New SELECT: own folder OR same-tenant member (via tenant_memberships) OR super_admin
CREATE POLICY "profile_photos_read_same_tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND (
    -- Caller's own folder
    (storage.foldername(name))[1] = auth.uid()::text
    -- Or super admin
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    -- Or owner shares a tenant with the caller
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1
        FROM public.tenant_memberships caller_tm
        JOIN public.tenant_memberships owner_tm
          ON owner_tm.tenant_id = caller_tm.tenant_id
        WHERE caller_tm.user_id = auth.uid()
          AND owner_tm.user_id::text = (storage.foldername(name))[1]
      )
    )
  )
);

-- 4) Writes: only own folder
CREATE POLICY "profile_photos_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_photos_update_own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "profile_photos_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
