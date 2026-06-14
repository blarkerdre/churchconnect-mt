## Goal
Require admin password re-entry before deleting a follow-up.

## Changes (single file: `src/pages/Followups.jsx`)

1. Import `PasswordConfirmDialog` from `@/components/shared/PasswordConfirmDialog`.
2. Add state: `deleteTarget` (the follow-up object or null).
3. Trash button click → `setDeleteTarget(f)` (no more `window.confirm`).
4. Render `<PasswordConfirmDialog>` at the bottom with:
   - `open={!!deleteTarget}`, `onOpenChange` clears target
   - `title="Delete follow-up"`
   - `description` naming the person (e.g. "Permanently delete the follow-up for **{name}** and any related referrals/messages.")
   - `isPending={deleteMutation.isPending}`
   - `onConfirm` → `await deleteMutation.mutateAsync(deleteTarget.id)`, then clear target.

## Out of scope
- No changes to mutation logic, RLS, or any other page/component.
