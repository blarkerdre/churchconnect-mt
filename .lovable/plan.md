
## Plan: Password protection for sensitive Member/User actions

### Scope
Reuse the existing `DangerConfirmDialog` (built for exam deletes) to gate destructive/sensitive Member and User operations behind password re-auth + type-to-confirm.

### Actions to protect

**Member side** (`src/pages/Members.jsx` + `MemberFormDialog.jsx` + `MemberTable.jsx`):
1. **Delete member** — already has a confirm dialog; upgrade to `DangerConfirmDialog`
   - Impacts: "Member record, attendance history, follow-ups, sign-posts, pastoral cases, and registrations linked to this member will be permanently affected."
2. **Update member record** (save in `MemberFormDialog`) — gate the final submit behind password confirmation **only when editing an existing member** (not on create). Skip for self-profile edits via `MyProfile` (members editing their own data).

**User side** (`src/pages/UserManagement.jsx`):
3. **Delete user** (calls `admin-delete-user` edge function) — upgrade to `DangerConfirmDialog`
   - Impacts: "Auth account, profile, role assignments and tenant memberships will be permanently removed. Linked member records remain but become unlinked."
4. **Update user role / toggle ban / role assignment changes** — gate behind password confirmation (sensitive privilege changes).

### Component reuse
`DangerConfirmDialog` already supports:
- Custom title, entity name, confirm label, impact list, type-to-confirm, password re-auth via `supabase.auth.signInWithPassword`, async `onConfirm`.
- For **updates** (non-delete), pass `confirmLabel="Save changes"` and tone the impact list as "review impact" rather than red doom — but the existing red styling is fine since these are admin-privilege actions. Keep as-is for consistency.

### Edits

| File | Change |
|---|---|
| `src/pages/Members.jsx` | Replace existing delete confirm with `DangerConfirmDialog` |
| `src/components/members/MemberFormDialog.jsx` | On submit when editing existing member → open `DangerConfirmDialog` (confirmLabel: "Update member"); on confirm run the existing save mutation |
| `src/pages/UserManagement.jsx` | Wrap delete-user, role-change, and ban-toggle actions with `DangerConfirmDialog` |

### Security & multi-tenancy
- All existing `.eq("tenant_id", tenantId)` guards remain.
- Password re-auth via `supabase.auth.signInWithPassword({ email: user.email, password })` — same proven pattern.
- No DB migrations needed.

### Files
- **Edit**: `src/pages/Members.jsx`
- **Edit**: `src/components/members/MemberFormDialog.jsx`
- **Edit**: `src/pages/UserManagement.jsx`
- **Reuse**: `src/components/exams/DangerConfirmDialog.jsx` (already exists)
