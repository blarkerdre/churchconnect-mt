## Cause

In the previous migration I updated `storage.objects.bucket_id` from `church-documents` → `dashboard-banners`, but that only changed the metadata row. The underlying file in storage is still keyed under `church-documents/...` in S3. So the new public URLs return 404 ("Not found") and the slider shows nothing.

```
DB row says:  dashboard-banners/<tid>/banners/x.jpg   ✗ no file there
S3 has:       church-documents/<tid>/banners/x.jpg    (orphaned)
```

## Fix

1. Revert my earlier SQL `UPDATE storage.objects … SET bucket_id` so the metadata matches reality again (28 banner rows go back to `church-documents`).
2. Run a one-shot Node script (uses `SUPABASE_SERVICE_ROLE_KEY`) that, for each banner object:
   - downloads it from `church-documents`
   - uploads it into `dashboard-banners` at the same path
   - deletes the original from `church-documents`
3. Verify a sample URL returns 200.
4. The `app_settings.dashboard_banners` URLs already point to `dashboard-banners` from the prior migration, so no further DB update is needed once the actual files are there.

No client-code changes — `DashboardBannerSettings.jsx` already writes to `dashboard-banners`.

`church-documents` stays private (security finding remains resolved).
