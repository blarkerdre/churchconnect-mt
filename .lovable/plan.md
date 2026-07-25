# Enable auto-rotation with device screen

Right now the dynamic PWA manifest in `supabase/functions/get-manifest/index.ts` sets `orientation: "portrait"`, which forces installed PWA users into portrait even when their phone/tablet is rotated. Regular browser tabs already rotate freely; only the installed app is locked.

## Change

- Update `supabase/functions/get-manifest/index.ts` to `orientation: "any"` so the OS follows the device rotation.
- No CSS orientation lock exists elsewhere, so browser tabs and desktop are already fine.

## Notes

- Installed PWAs need to be reinstalled (or the manifest refetched) for the new value to take effect — the OS caches the original manifest.
- No app UI changes; existing layouts are already responsive.

Shall I go ahead?
