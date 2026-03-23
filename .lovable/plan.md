

## Plan: Admin-Editable WoFBI About Section

### Summary
Add a WoFBI description section on the member-facing page that explains what WoFBI stands for. The content is stored in `app_settings` (key: `wofbi_about`) so admins can edit it from the admin view.

### Changes

**`src/pages/ExamManagement.jsx`**

1. **Member view** (around line 666): Add an info card below the heading that displays the `wofbi_about` setting. Use `useAppSetting("wofbi_about", "...")` with a sensible default like: *"WoFBI — Word of Faith Bible Institute — is a structured Bible training programme designed to equip believers with foundational knowledge of God's Word through courses and examinations."*

2. **Admin view**: Add a "WoFBI About" card/section (e.g. in a new Settings-like area or above the course list) with a textarea and save button that upserts the `wofbi_about` key in `app_settings`. This lets admins customize the description members see.

### Technical Detail
- Uses existing `app_settings` table (already has admin RLS for writes, authenticated for reads)
- Store as a single string value under key `wofbi_about`
- Modify `useAppSetting` call or inline query since this is a string, not an array
- Single file change: `src/pages/ExamManagement.jsx`

