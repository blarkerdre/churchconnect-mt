
-- Update storage RLS policies for tenant-scoped file isolation
-- church-documents bucket: scope access by tenant_id folder prefix
DROP POLICY IF EXISTS "Admins and leaders can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and leaders can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and leaders can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to church-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read church-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete church-documents" ON storage.objects;

-- Allow authenticated users to upload to their tenant's folder in church-documents
CREATE POLICY "Tenant-scoped upload church-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.user_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

-- Allow authenticated users to read from their tenant's folder
CREATE POLICY "Tenant-scoped read church-documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.user_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

-- Allow authenticated users to delete from their tenant's folder
CREATE POLICY "Tenant-scoped delete church-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.user_has_tenant_access((storage.foldername(name))[1]::uuid)
  );

-- Profile photos: users can manage their own photos
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read profile photos" ON storage.objects;

CREATE POLICY "Users upload own profile photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can read profile photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users delete own profile photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Book covers: admins can manage, anyone can read
DROP POLICY IF EXISTS "Admins can upload book covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read book covers" ON storage.objects;

CREATE POLICY "Admins upload book covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers' AND public.is_admin(auth.uid()));

CREATE POLICY "Anyone reads book covers" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'book-covers');

CREATE POLICY "Admins delete book covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers' AND public.is_admin(auth.uid()));
