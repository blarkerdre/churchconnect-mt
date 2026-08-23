# Fix profile photo upload problems

## What I checked

The photo upload path is a single place: the avatar in My Profile. It uploads to the private `profile-photos` bucket under `<your-user-id>/<timestamp>.<ext>` and saves the path on your member record. Storage permissions and the bucket itself are configured correctly (private, own-folder write, signed-URL reads), so this is not a permissions problem.

What the code actually does wrong:

1. **iPhone photos (HEIC/HEIF) are accepted but never display.** The picker accepts any `image/*`, so an iPhone HEIC file uploads fine and the record updates — but browsers cannot render HEIC, so the avatar stays as initials and it looks like the upload failed.
2. **No size limit and no compression.** A 5-12MB camera photo is uploaded at full size. On a slow mobile connection this can stall or time out, and it burns through the church's storage allowance very quickly.
3. **Fragile file naming.** The extension is taken from the file name; a file with no extension produces a broken path/type.
4. **Old photos are never removed.** Each new upload leaves the previous file behind, so storage usage keeps growing and can eventually hit the church's storage limit — after which uploads start failing with a quota message.
5. **No admin route.** Admins editing a member have no way to set/replace that member's photo, so a member who can't upload cannot be helped by staff.
6. **Weak error feedback.** Failures show the raw technical message rather than a plain explanation (too large, unsupported type, quota reached).

## What I'll change

- Restrict the file picker to renderable formats (`image/jpeg,image/png,image/webp,image/heic,image/heif`) and validate the selected file's type before uploading.
- Client-side process every selected image before upload: draw to a canvas, downscale to max 1024px on the long edge, and re-encode as JPEG (quality ~0.85). This converts HEIC on devices that can decode it, and cuts typical uploads to a few hundred KB. If decoding fails (e.g. desktop HEIC), show a clear "This photo format isn't supported — please choose a JPG or PNG" message instead of uploading an unviewable file.
- Enforce a 5MB pre-processing cap with a friendly message.
- Always write `<user-id>/<timestamp>.jpg`; delete the member's previous photo object after a successful upload and record update, so storage doesn't grow unbounded.
- Replace raw error text with plain-English messages for the common cases (too large, unsupported format, storage limit reached, offline).
- Add the same avatar upload control to the admin member edit dialog, scoped so admins can only set photos for members in their own church.

## Technical notes

- Upload/processing logic moves into a small shared helper (e.g. `src/lib/image-upload.js`) so My Profile and the admin member form use identical behaviour.
- No database or storage-policy changes needed; existing `profile_photos_*` policies already cover own-folder writes. The admin upload will write to the member's own `<user_id>/` folder via an edge function or, where the member has no linked account, a `member-<id>/` folder covered by an added admin-write policy scoped by tenant.
- Reads continue to use the existing signed-URL hook; its cache is keyed by path, and since paths change per upload, the new photo appears immediately.
