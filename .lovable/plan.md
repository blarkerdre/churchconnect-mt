

## Plan: Add Tenant Badge to Dashboard

### What
Add a small indicator card below the welcome banner on all dashboard views (Member, Admin, WSF Leader) showing the current tenant name and the user's role within that tenant.

### Changes

**1. `src/components/dashboard/MemberDashboard.jsx`**
- Import `useTenant` from `@/contexts/TenantContext`
- Replace the hardcoded "Winners Chapel International Cardiff" subtitle in the welcome banner with `currentTenant?.name`
- Add a role badge (e.g., "Member", "Admin", "Owner") next to the tenant name using the tenant context's `tenantRole`

**2. `src/pages/Dashboard.jsx` (Admin dashboard)**
- Import `useTenant` from `@/contexts/TenantContext`
- Add a tenant context bar above or within the stats grid showing the tenant name and role badge (e.g., "Admin" / "Owner")

**3. `src/components/dashboard/WSFLeaderDashboard.jsx`**
- Same treatment — import `useTenant` and add tenant name + role indicator

### Design
The tenant name replaces the hardcoded church name in the welcome banner subtitle. The tenant role appears as a small badge alongside it. This keeps it visible on both mobile and desktop without adding extra cards.

```text
┌─────────────────────────────────┐
│ Welcome, John!                  │
│ My Church Name · Owner          │
│ [Active] [Choir]                │
└─────────────────────────────────┘
```

### Technical Details
- `useTenant()` already exposes `currentTenant` (with `.name`, `.logo_url`), `tenantRole`, `isTenantAdmin`, `isTenantOwner`
- No new queries or migrations needed
- Role label: capitalize `tenantRole` (owner → Owner, admin → Admin, member → Member)

