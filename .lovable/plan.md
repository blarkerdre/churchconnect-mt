## Bulk select & move sermon notes

Add a selection mode to the Sermon Notes page so users can pick several notes and move them to a folder (or unfile them) in one action. Also support bulk delete since it's a natural fit.

### UX flow

1. A new **Select** button appears next to **New Note** in the page header.
2. Tapping it enters "selection mode":
   - Each note card shows a checkbox in the top-left.
   - The card click no longer opens the editor — it toggles selection instead.
   - A sticky action bar appears at the bottom (mobile) / top of the grid (desktop) showing:
     - "N selected"
     - **Select all / Clear**
     - **Move to folder** dropdown (lists Unfiled + all user folders)
     - **Delete** (destructive, with confirm dialog)
     - **Cancel** to exit selection mode
3. Exiting selection mode clears all selections and restores normal click-to-edit behavior.

Selection is preserved while filters/search change so users can compose a selection across views; it clears on exit or successful bulk action.

### Technical changes

**`src/pages/SermonNotes.jsx`** (only file touched for logic)
- Add state: `selectionMode` (bool), `selectedIds` (Set), `bulkMoveTarget` state, `bulkDeleteOpen` (bool).
- Header: add a **Select** / **Done** toggle button next to **New Note**.
- Note card rendering:
  - When `selectionMode` is on, render a `Checkbox` (from `@/components/ui/checkbox`) in the top-left of each card; hide the per-card Edit / MoreVertical action buttons.
  - Card `onClick` toggles `selectedIds` instead of opening the form.
  - Apply a subtle ring (`ring-2 ring-primary`) to selected cards.
- Bulk action bar (rendered above the grid when `selectionMode` is on, sticky on mobile):
  - "N selected • Select all (filtered) / Clear"
  - `DropdownMenu` "Move to folder" → Unfiled + each folder → calls `handleBulkMove(folderId | null)`.
  - "Delete" button → opens existing-style `AlertDialog`.
  - "Cancel" exits selection mode.
- Handlers:
  - `handleBulkMove(folderId)`: single Supabase update — `.update({ folder_id: folderId }).in("id", [...selectedIds]).eq("user_id", user.id).eq("tenant_id", tenantId)`. On success: toast `Moved N notes`, invalidate `sermon_notes`, clear selection, exit mode.
  - `handleBulkDelete()`: same pattern with `.delete().in("id", ...)`. Toast `Deleted N notes`.
  - `handleSelectAllFiltered()`: sets `selectedIds` to all ids in the currently visible `processed` list.
- All queries continue to be tenant-scoped via existing `.eq("tenant_id", tenantId)` guards.

### Out of scope

- No DB migration — uses existing `folder_id` column.
- No changes to `SermonNoteFormDialog` or `SermonFolderSidebar`.
- No drag-and-drop (selection-mode flow works on mobile 384px viewport).

### Files

- Edit: `src/pages/SermonNotes.jsx`
