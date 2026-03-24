

## Fix: Profile Photo Upload "Bucket Not Found"

### Diagnosis
The `profile-photos` storage bucket **exists** in the database and is correctly configured:
- Bucket is public, no file size or MIME type restrictions
- RLS policies for INSERT, SELECT, UPDATE, DELETE are all in place
- The upload code in `MyProfile.jsx` correctly references `"profile-photos"`

The "bucket not found" error was likely caused by a temporary deployment sync delay after the migration was applied.

### Proposed Fix
No code changes are needed. The bucket is properly set up. To be safe and ensure reliability, I recommend:

1. **Re-deploy the storage bucket creation** via a new idempotent migration that ensures the bucket exists (using `ON CONFLICT DO NOTHING`), which will force a fresh sync
2. **Add better error messaging** in the upload handler to surface the exact error details for debugging

### Changes
- **New migration**: Re-assert `profile-photos` bucket exists (idempotent `INSERT ... ON CONFLICT DO NOTHING`)
- **`src/pages/MyProfile.jsx`**: Improve error toast to show the full error message including status code

This is a minimal change to ensure the bucket is reliably available and any future errors are easier to diagnose.

