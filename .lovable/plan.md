

## Plan: Rearrange User Management Page with Search and Filter

### What changes

1. **Add search bar** — text input that filters users by name or email (client-side, instant filtering)

2. **Add role filter dropdown** — Select dropdown to filter users by role (super_admin, admin, unit_leader, wsf_leader, member, or "All")

3. **Add status filter** — Filter by account status (All / Active / Disabled)

4. **Rearrange layout** — Move the search bar and filters into a toolbar row between the page header and the table. Action buttons (Add User, Bulk Unit Assign) stay in the header. Add a user count indicator showing filtered/total.

5. **Show "no results" state** when filters match nothing

### Layout structure

```text
┌─────────────────────────────────────────────────┐
│ User Management          [Bulk Assign] [Add User]│
│ Manage user roles and permissions                │
├─────────────────────────────────────────────────┤
│ [🔍 Search by name or email...] [Role ▼] [Status ▼]  │
│                                    Showing X of Y│
├─────────────────────────────────────────────────┤
│ User | Email | Roles | Units | Manage | Actions  │
│ ... filtered rows ...                            │
└─────────────────────────────────────────────────┘
```

### Technical details

**File: `src/pages/UserManagement.jsx`**

- Add `searchQuery`, `roleFilter`, and `statusFilter` state variables
- Compute `filteredProfiles` from `profiles` by applying all three filters:
  - Search: case-insensitive match on `full_name` or `email`
  - Role: check if user has the selected role via `getUserRoles()`; "All" shows everyone
  - Status: filter by `disabledUsers` map; "All" shows everyone
- Replace `profiles.map(...)` with `filteredProfiles.map(...)`
- Add a toolbar row with the Input (search icon), two Select dropdowns, and a count badge
- Import `Search` icon from lucide-react

No database changes needed. All filtering is client-side on already-fetched data.

