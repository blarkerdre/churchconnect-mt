

## Fix: Profile Photo Storage Policies Missing Ownership Check

### Problem

The `profile-photos` bucket has duplicate and insecure RLS policies on `storage.objects`:

| Policy | Operation | Ownership check? |
|--------|-----------|-------------------|
| `Users can update own profile photos` | UPDATE | **No** — only checks `bucket_id` |
| `Users can delete own profile photos` | DELETE | **No** — only checks `bucket_id` |
| `Users delete own profile photos` | DELETE | Yes — checks folder = `auth.uid()` |
| `Users upload own profile photos` | INSERT | Yes — checks folder = `auth.uid()` |
| `Authenticated users can upload profile photos` | INSERT | **No** — only checks `bucket_id` |

Any authenticated user can overwrite or delete any other user's profile photo.

### Fix (single SQL migration)

1. **Drop** the 3 insecure policies: `Users can update own profile photos`, `Users can delete own profile photos`, and `Authenticated users can upload profile photos`
2. **Re-create** the UPDATE policy with path ownership: `(storage.foldername(name))[1] = auth.uid()::text`
3. Keep the existing secure DELETE (`Users delete own profile photos`) and INSERT (`Users upload own profile photos`) policies — they already have the correct ownership check

```sql
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile photos" ON storage.objects;

CREATE POLICY "Users can update own profile photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Files changed
- Database migration only (no code changes needed)

