## Goal
Allow admins to edit (and delete) existing church attendance records on the Church Attendance page.

## Changes (single file: `src/pages/ChurchAttendance.jsx`)

1. **Reuse the existing dialog for both create and edit**
   - Add `editingId` state. When set, the dialog title becomes "Edit Church Attendance" and submit calls update instead of insert.
   - Add `openEdit(report)` that pre-fills `form` from the row and opens the dialog.
   - Reset `editingId` to `null` when dialog closes or after save.

2. **Update mutation**
   - Add `updateMutation` that runs `supabase.from("church_attendance_reports").update(payload).eq("id", editingId).eq("tenant_id", tenantId)`.
   - `handleSubmit` routes to update vs insert based on `editingId`. Payload recomputes `total_attendance`.

3. **Delete mutation**
   - Add `deleteMutation` with a `window.confirm` guard. Scoped via `.eq("id", id).eq("tenant_id", tenantId)`.

4. **Row actions (admin only)**
   - In each table row, when `isAdmin`, render a small Pencil and Trash icon button alongside the existing Paperclip toggle.
   - Pencil → `openEdit(r)`; Trash → `deleteMutation.mutate(r.id)`.

5. **Cache invalidation + toasts** for both update and delete, matching the existing save flow.

## Out of scope
- No schema changes (existing RLS already allows admins to update/delete tenant-scoped rows).
- No changes to attachments, charts, filters, CSV/print, or summary cards.
- Non-admins keep read-only view.