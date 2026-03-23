

## Make House Provider Selectable from Members

### Problem
The "House Provider" field is currently a free-text input. It should be a dropdown that selects from existing church members.

### Approach
Add a new `host_member_id` UUID column to `wsf_centres` (keeping `host_name` for backward compatibility/display). The form will use a Select dropdown populated with all members. On save, store both the member ID and derive the display name.

Actually, simpler approach: replace `host_name` (text) usage with a member selector. Store `host_member_id` as a new column, and on save derive `host_name` from the selected member for display convenience.

### Changes

1. **Database migration** — Add `host_member_id UUID` column to `wsf_centres`.

2. **Update `WSFCentresSection.jsx`**:
   - Add a query to fetch all members (`id, first_name, last_name`) for the dropdown.
   - Replace the House Provider `<Input>` with a `<Select>` dropdown listing members by name.
   - Store `host_member_id` in form state instead of (or alongside) `host_name`.
   - On save, set both `host_member_id` and auto-populate `host_name` from the selected member's name.
   - On the centre card, resolve the member name from the members list (fallback to `host_name` text if set).

3. **Update `WSFCentreFormDialog.jsx`** — Same pattern: replace text input with member selector (this component receives `onSave` from parent, so it just needs the members list passed in or fetched).

### Technical detail
- Migration: `ALTER TABLE public.wsf_centres ADD COLUMN host_member_id UUID;`
- No foreign key to `auth.users` — references `members.id` conceptually but kept as a plain UUID to avoid cascade issues.
- `host_name` is kept and auto-populated so display works without extra joins elsewhere.

