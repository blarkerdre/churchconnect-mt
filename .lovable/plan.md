## Goal
Allow admins to edit and delete training session records on the Training Report page.

## Changes (single file: `src/pages/TrainingReports.jsx`)

1. **Reuse the existing Record Session dialog for edit**
   - Add `editingId` state. When set, dialog title becomes "Edit Training Session" and submit routes to update instead of insert.
   - Add `openEdit(report)` that pre-fills `form` from the row and opens the dialog. Attendees panel remains scoped to add-new flow only — edits of attendees continue via the existing `TrainingAttendeesPanel` in the expanded row.
   - Reset `editingId` and form when dialog closes.

2. **Update mutation**
   - Add `updateMutation` that runs `supabase.from("training_reports").update(payload).eq("id", editingId).eq("tenant_id", tenantId)`. Recomputes `total_attendance` from male+female.
   - `handleSubmit` calls update when `editingId` is set, otherwise the existing insert path.

3. **Delete mutation**
   - Add `deleteMutation` with `window.confirm` guard, scoped via `.eq("id", id).eq("tenant_id", tenantId)`. RLS already allows admins.
   - Cascading attendee/attachment rows: delete child rows in `training_attendees` for that report first (scoped by tenant) so the parent delete succeeds regardless of FK config.

4. **Row actions (admin only)**
   - Add Pencil and Trash icon buttons in the actions cell alongside the existing Users (expand) button, gated on `isAdmin`.
   - Pencil → `openEdit(r)`; Trash → confirm → `deleteMutation.mutate(r.id)`.

5. **Cache invalidation + toasts** for both update and delete, matching the existing save flow (`training-reports` + `certificate-approvals`).

## Out of scope
- No schema/RLS changes.
- No changes to filters, summary cards, CSV/print, attendees panel, or attachments.
- Non-admins keep current view (Training Reps can still manage attendees but not edit/delete the session record).
