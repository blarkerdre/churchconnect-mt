

## Plan: Enhanced Tenant Lifecycle Management in Tenant Admin

### What Exists
- Archive, restore, and permanent delete already work via the `archive-tenant` edge function
- Permanent delete is only available for archived tenants (two-step: archive first, then delete)
- Delete requires typing "DELETE {slug}" to confirm
- Page is restricted to `super_admin` role via `SuperAdminRoute`

### What We'll Add

**1. Direct permanent delete for active tenants (with extreme friction)**
- Add a "Delete Permanently" action for active tenants (not just archived ones)
- Multi-step confirmation: first an alert explaining consequences, then typing "PERMANENTLY DELETE {slug}", then a final password re-authentication step
- Red danger styling throughout

**2. Stronger warning UI for all destructive actions**
- List what will be deleted: members, attendance, events, follow-ups, pastoral care, communications, exams, documents, storage files, user accounts
- Show member/user counts in the warning
- Add an explicit "This action is irreversible" banner with a skull/alert icon

**3. Restore archived tenants with data integrity warning**
- Already works but add a clearer confirmation dialog explaining that restoring will reactivate the tenant and make it visible to its users again
- Show tenant stats in the restore dialog

**4. Tenant data visibility panel**
- Add a "View Data" button for each tenant that shows a summary of associated data counts (members, events, attendance sessions, follow-ups, etc.)
- This lets the admin see what data belongs to each tenant before taking action

**5. Access control enforcement**
- Page is already behind `SuperAdminRoute` -- no change needed
- Add a reminder banner at the top: "Super Admin Only — Changes here affect all tenants"

### Files to Change

**`src/pages/TenantAdmin.jsx`**
- Add permanent delete button for active tenants with enhanced multi-step confirmation dialog
- Add restore confirmation dialog with tenant info
- Add "View Data" action per tenant showing data counts
- Add admin-only visibility banner
- Strengthen warning text and styling for all destructive dialogs

**`supabase/functions/archive-tenant/index.ts`**
- Add `password` field support for delete action (re-authentication like purge-all-data does)
- Verify password before executing permanent delete

### Technical Details
- The edge function already handles the `delete` action with full cascading cleanup across 35+ tables
- Password re-authentication will use `supabase.auth.signInWithPassword()` (same pattern as `purge-all-data`)
- Data counts query will reuse the existing `tenantStats` pattern, extended with more tables
- No database migrations needed

