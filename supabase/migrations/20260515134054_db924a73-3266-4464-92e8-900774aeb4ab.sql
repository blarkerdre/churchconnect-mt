
-- 1. Create new public bucket for dashboard banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('dashboard-banners', 'dashboard-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. RLS policies for dashboard-banners
DROP POLICY IF EXISTS "Public can view dashboard banners" ON storage.objects;
CREATE POLICY "Public can view dashboard banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'dashboard-banners');

DROP POLICY IF EXISTS "Tenant admins can upload dashboard banners" ON storage.objects;
CREATE POLICY "Tenant admins can upload dashboard banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dashboard-banners'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant admins can update dashboard banners" ON storage.objects;
CREATE POLICY "Tenant admins can update dashboard banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dashboard-banners'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Tenant admins can delete dashboard banners" ON storage.objects;
CREATE POLICY "Tenant admins can delete dashboard banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dashboard-banners'
  AND public.is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3. Move existing banner objects from church-documents to dashboard-banners
UPDATE storage.objects
SET bucket_id = 'dashboard-banners'
WHERE bucket_id = 'church-documents'
  AND name LIKE '%/banners/%';

-- 4. Rewrite saved banner URLs in app_settings (jsonb array of slides)
UPDATE public.app_settings
SET value = REPLACE(value::text, '/storage/v1/object/public/church-documents/', '/storage/v1/object/public/dashboard-banners/')::jsonb
WHERE key = 'dashboard_banners'
  AND value::text LIKE '%/church-documents/%/banners/%';

-- 5. Make church-documents private again
UPDATE storage.buckets SET public = false WHERE id = 'church-documents';
