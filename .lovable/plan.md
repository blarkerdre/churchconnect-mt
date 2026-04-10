

## Fix: Banner Images Not Displaying

### Root Cause
The `DashboardBanner` component uses `getPublicUrl()` to generate image URLs, which produces URLs like `/storage/v1/object/public/church-documents/...`. These return 404 "Bucket not found" because:
1. The bucket may not exist (creation migration may have failed)
2. The bucket was created with `public: false`, but public URLs only work for public buckets

### Fix

#### Database migration
Run a single migration to ensure the bucket exists and is public:

```sql
-- Ensure bucket exists and is public (so getPublicUrl works for banner images)
UPDATE storage.buckets SET public = true WHERE id = 'church-documents';

-- If it doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('church-documents', 'church-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

Making the bucket public allows anyone to **read** files via public URLs, which is needed for dashboard banners visible to all users. Upload/delete access is still controlled by the existing RLS policies on `storage.objects`.

#### No code changes needed
The `DashboardBanner.jsx` and `DashboardBannerSettings.jsx` code is correct. The only issue is the storage bucket configuration.

### Files changed
- **Database migration** — ensure `church-documents` bucket exists and is public

