## Goal
In `MemberFormDialog`, role checkboxes currently mutate immediately (`onCheckedChange` calls `toggleRoleMutation.mutate`). Change this so role edits are staged locally and only persisted when the user clicks the dialog's **Update** button.

## Changes — `src/components/members/MemberFormDialog.jsx`

1. **Add staged state**
   - New `pendingRoles` state (a `Set` or string array) initialised from `memberRoles` when the dialog opens / `memberRoles` changes.
   - Reset on dialog close, member switch, and after successful save.

2. **Switch checkboxes to local state**
   - `checked` reads from `pendingRoles` instead of `userRoles`.
   - `onCheckedChange` updates `pendingRoles` only — no mutation call.
   - Remove the `disabled={toggleRoleMutation.isPending}` tie to the inline mutation.
   - Keep the read-only badge row showing **saved** roles (unchanged), so the user sees current vs. pending. Add a small "Unsaved role changes" hint when `pendingRoles` differs from saved `userRoles`.

3. **Apply on Update**
   - In the existing submit handler (the one tied to the Update button), after the member save succeeds and only when `canChange` is true:
     - Diff `pendingRoles` vs. saved `userRoles`.
     - For each added role: insert into `user_roles` (with tenant) and `logAudit("role_add", ...)`.
     - For each removed role: delete from `user_roles` scoped by `user_id`, `role`, `tenant_id` and `logAudit("role_remove", ...)`.
     - Invalidate `["member-roles", memberUserId]` and `["all-user-roles"]` queries.
   - Show a single toast covering role updates (or fold into existing save toast).

4. **Cleanup**
   - Remove `toggleRoleMutation` if no longer used elsewhere in the file (verify first); otherwise leave it.

## Out of scope
- No backend / SQL / RLS changes.
- No changes to `TenantUsersDialog` (already done).
- No visual redesign beyond the small "unsaved changes" hint.
