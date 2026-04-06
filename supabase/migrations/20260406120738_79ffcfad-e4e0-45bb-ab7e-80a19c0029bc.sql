
-- ================================================
-- Fix: Scope storage.objects policies to tenant_id
-- ================================================

-- CHURCH-DOCUMENTS: Drop all existing unscoped policies
DROP POLICY IF EXISTS "Admins/leaders can read church docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins/leaders can upload church docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins/leaders can delete church docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant-scoped read church-documents" ON storage.objects;

-- CHURCH-DOCUMENTS: Recreate with tenant-scoped checks
CREATE POLICY "Tenant-scoped read church-documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY "Tenant-scoped upload church-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY "Tenant-scoped delete church-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

-- BOOK-COVERS: Drop existing unscoped policies
DROP POLICY IF EXISTS "Admins can update book covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete book covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete book covers" ON storage.objects;

-- BOOK-COVERS: Recreate with tenant-scoped checks
CREATE POLICY "Tenant-scoped update book-covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Tenant-scoped delete book-covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
