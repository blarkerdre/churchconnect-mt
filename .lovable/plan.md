

User wants three additions to the Tenant Users tab in `TenantUsersDialog.jsx`:

1. **Search** for users in the list
2. **Password confirmation** before destructive/sensitive actions
3. **Warning dialog** before delete or role change

Let me think about scope:

- "Password" — most likely they mean password re-auth before destructive actions (matches existing pattern from `mem://auth/tenant-switching-security` where password re-auth is required for tenant switching). I'll combine password + warning into a single confirm dialog.
- Search — simple client-side filter on `full_name` and `email` from the already-fetched memberships.
- Warning — AlertDialog before role change AND before delete. Password re-auth required inside the warning dialog.

Actions to gate:
- Role change (member → admin → owner, in either direction)
- Remove user from tenant
- Super-admin shortcut buttons (promote to Admin / Owner)

Existing assets:
- `alert-dialog.jsx` already exists
- `supabase.auth.signInWithPassword` for re-auth (matches existing tenant-switching pattern)
- `Input` component supports `type="password"`

## Plan

### Edit `src/components/tenants/TenantUsersDialog.jsx`

**1. Add search bar** above the Users table
- New state: `const [search, setSearch] = useState("")`
- Filter `memberships` by name/email (case-insensitive) before rendering
- Show "No users match" when filter empties result
- Place a small `Input` with search icon directly above the `<Table>` in the Users tab

**2. Add confirm-and-reauth dialog**
- New state: `pendingAction` (object: `{ type, membership, newRole?, label }`) and `confirmPassword`
- New `<AlertDialog>` rendered once at the bottom of the component, opens when `pendingAction` is set
- Body explains the action in plain English (e.g. "Change Jane Doe's role from Member to Owner. This grants full church control.")
- Includes a password input — required to proceed
- "Confirm" button:
  - Calls `supabase.auth.signInWithPassword({ email: currentUserEmail, password })` to verify
  - On success, dispatches the original mutation (`updateRoleMutation` or `removeMutation`)
  - On failure, toast error, keep dialog open
- "Cancel" closes dialog and clears state

**3. Wire all destructive actions through the new dialog**
- Role `<Select onValueChange>` → instead of mutating directly, set `pendingAction` and revert the visual state (controlled value remains `m.role` until confirmed)
- Delete `<Button onClick>` → set `pendingAction` of type `"remove"`
- Super-admin promote-to-admin / promote-to-owner shortcuts → also route through `pendingAction`

**4. Severity-aware warning copy**
- Promotion to Owner → red/destructive styling, "This grants full control of the church"
- Demotion from Owner → amber, "This user will lose church-wide control"
- Remove → red, "This user will lose all access to this church"
- Member ↔ Admin → neutral amber

### No DB / RLS changes
Existing RLS already protects the operations server-side; this is a UX guardrail only.

### Files
**Edit**
- `src/components/tenants/TenantUsersDialog.jsx`

### Out of scope
- Password re-auth on the Invite form (not destructive)
- Audit logging of role changes (covered in separate suggestion previously)
- Super_admin grant flow

