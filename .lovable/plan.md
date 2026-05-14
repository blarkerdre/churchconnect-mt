# Make `profile-photos` private with same-tenant signed reads

## The blocker

Today `profile-photos` is a single public bucket holding **two unrelated kinds of files**:

- Member photos under `<user_id>/...`
- Tenant branding (logo, favicon, OG image, PWA icon) under `<tenant_id>/tenant-*.ext`, used by `Settings.jsx`, the unauthenticated login page, social-media crawlers, and PWA installs.

Flipping the bucket to private breaks every branding asset for anonymous viewers. So step 1 is to split branding off, then we can lock the photos bucket down.

## Step 1 — New `tenant-branding` public bucket (migration)

```
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-branding','tenant-branding', true);
```

RLS on `storage.objects`:

- **SELECT** — public (`bucket_id = 'tenant-branding'`).
- **INSERT / UPDATE / DELETE** — only when `bucket_id = 'tenant-branding'` AND `is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)` (tenant-scoped admin).

## Step 2 — Migrate existing branding files

A one-shot Edge Function `migrate-tenant-branding` (invoked once by a super_admin from the existing Tenant Admin → Maintenance area, or run via curl):

1. List all objects in `profile-photos` whose name matches `^[0-9a-f-]{36}/tenant-(logo|favicon|og|pwa-icon)\.[a-z0-9]+$`.
2. For each: download from `profile-photos`, upload to `tenant-branding` at the same path.
3. Update `tenants.logo_url` and `tenants.settings.{favicon_url,og_image_url,pwa_icon_url}` so the host portion points to the new bucket.
4. After verification, delete the originals from `profile-photos`.

The function is idempotent and safe to re-run.

## Step 3 — Frontend writes for branding go to the new bucket

Update `src/pages/Settings.jsx` (lines ~589 and ~738): change `.from("profile-photos")` to `.from("tenant-branding")` for logo, favicon, OG image and PWA icon uploads. `getPublicUrl` continues to work because the new bucket is public.

## Step 4 — Lock `profile-photos` down

Migration:

- `UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';`
- Drop existing SELECT/INSERT/UPDATE/DELETE policies for `profile-photos`.
- New policies (signed-URL access requires the user to also pass RLS):
  - **SELECT**: `bucket_id = 'profile-photos'` AND
    - `(storage.foldername(name))[1] = auth.uid()::text` *(own folder — covers branding-style writes that may have used user folders)*, **OR**
    - the file's owner shares a tenant with the caller. We resolve "owner" through the `members` table:
      ```
      EXISTS (
        SELECT 1
        FROM public.members caller
        JOIN public.members owner
          ON owner.tenant_id = caller.tenant_id
        WHERE caller.user_id = auth.uid()
          AND owner.user_id::text = (storage.foldername(name))[1]
      )
      ```
      This mirrors today's visibility (any member of the same tenant can see peer photos) without leaking across tenants.
  - **INSERT / UPDATE / DELETE**: only own folder (`(storage.foldername(name))[1] = auth.uid()::text`) — same as the current write rules.

## Step 5 — Stop storing public URLs; switch to on-demand signed URLs

### Schema / data

- Keep `members.photo_url` but redefine its meaning: it now stores the **storage path** (e.g. `8f3a.../1731000000000.jpg`), not a full URL. Add a comment to the column.
- One-shot SQL migration to rewrite existing values: strip the `…/storage/v1/object/public/profile-photos/` prefix, leaving just the path. Rows that don't match the pattern are left null.

### Frontend

Add `src/hooks/useSignedMemberPhoto.js`:

```text
useSignedMemberPhoto(path) -> { url, loading }
  - Returns null if path is null
  - If path looks like a full http(s) URL (legacy), returns it as-is (transitional)
  - Otherwise calls supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
  - Caches by path in a module-level Map keyed (path) -> { url, expiresAt }
  - Refreshes when within 5 min of expiry
```

Add `src/components/members/MemberAvatar.jsx` that wraps `<img>` / `Avatar` and uses the hook so we can swap implementations in one place.

Update read sites (replace direct `member.photo_url` `<img src=…>` with `<MemberAvatar member={…} />`):

- `src/pages/MyProfile.jsx`
- `src/components/dashboard/MemberDashboard.jsx`
- `src/components/dashboard/BirthdayCelebration.jsx`
- `src/components/dashboard/WSFLeaderDashboard.jsx`
- `src/components/dashboard/PendingJoinRequests.jsx`
- `src/components/followups/SignPostDetailPanel.jsx`
- `src/hooks/usePendingJoinRequests.jsx` (consumer renders via the new component)

### Upload site

`src/pages/MyProfile.jsx` `ProfilePhotoUpload`: stop calling `getPublicUrl`; persist `path` directly into `members.photo_url` via the existing `update_own_member_profile` RPC.

## Step 6 — Security follow-ups

- Mark the `profile_photos_bucket_cross_tenant_read` finding as fixed with a note describing the split + signed-URL approach.
- Update the security memory to record:
  - `profile-photos` is private; reads require RLS-validated `createSignedUrl`.
  - `tenant-branding` is the only public bucket for tenant-wide assets.
  - `members.photo_url` stores a storage path, not a URL.

## Out of scope

- Caching / CDN tuning for signed URLs (1-hour TTL is acceptable).
- Reworking how `book-covers` and `church-documents` buckets are accessed (separate findings).
- Pre-signing photos server-side in batch (we sign per-render; can revisit if performance becomes an issue).

## Risk / rollback

- The branding migration is the riskiest step because it touches `tenants.logo_url` / `settings`. The migration function writes to the new bucket first and only updates DB rows after successful upload, then deletes originals as a final pass — so a partial failure leaves both copies in place and rows still pointing to the old (still-public) bucket.
- Flipping `public = false` on `profile-photos` is the point of no return for legacy public photo URLs. Done **after** the path-rewrite data migration so the app is already reading via `createSignedUrl`.
