
-- 1) Create new public bucket for tenant branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2) Drop any pre-existing policies on this bucket (idempotent)
DROP POLICY IF EXISTS "tenant_branding_public_read" ON storage.objects;
DROP POLICY IF EXISTS "tenant_branding_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_branding_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "tenant_branding_admin_delete" ON storage.objects;

-- 3) Public read for tenant-branding bucket
CREATE POLICY "tenant_branding_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-branding');

-- 4) Tenant-scoped admin write (folder name must be a UUID matching a tenant the caller admins)
CREATE POLICY "tenant_branding_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "tenant_branding_admin_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "tenant_branding_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-branding'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
