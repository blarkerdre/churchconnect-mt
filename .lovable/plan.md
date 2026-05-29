Goal: Improve role-change UX in TenantUsersDialog and clarify that the picker controls church-level membership, not app-level user roles.

Changes in `src/components/tenants/TenantUsersDialog.jsx`:

1. Column header rename  
   - Change `Role` → `Church Role` in the users table header.

2. Tooltip helper  
   - Wrap the role `<Select>` with a `<Tooltip>` that says:  
     "This sets the user's role within this specific church."

3. Staged update flow  
   - Remove `onValueChange` from the inline `<Select>` so changing the dropdown no longer triggers a confirmation dialog immediately.
   - Add per-row state (`editingRole`) that stores the newly selected role.
   - Show an **Update** button next to the Select when the value differs from the saved role. Clicking it opens the existing confirmation dialog.
   - Show a **Cancel** button to revert the Select to the saved role.
   - Keep all existing confirmation-token logic and mutations unchanged.

No backend or new files needed.