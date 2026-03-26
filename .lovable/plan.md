

## Plan: Show Active Tenant Indicator + Password Confirmation on Tenant Switch

### What We're Building

1. **Persistent tenant indicator in the header** -- a small badge/chip showing the current tenant name visible on every page, so admins always know which tenant context they're operating in.

2. **Password confirmation when switching tenants** -- before completing a tenant switch, show a dialog requiring the user to re-enter their password. This prevents accidental or unauthorized context switches.

### Implementation

#### 1. Active Tenant Badge in Header (AppLayout.jsx)

In the sticky header (line ~248), add a tenant name badge next to the environment label and role badge. Visible to all users (not just admins), showing `currentTenant?.name`.

```text
[Page Title]                    [ENV] [Tenant: Demo Church] [Role] [Bell] [Logout]
```

- Small pill/chip styled similarly to the existing role badge
- Shows tenant logo (tiny, 16px) + name
- Always visible, even on mobile

#### 2. Password Confirmation Dialog on Tenant Switch (AppLayout.jsx)

Replace the instant `switchTenant()` call in the tenant dropdown (line 136) with:
- Store the selected `tenant_id` in state (`pendingTenantSwitch`)
- Open a confirmation dialog asking for the user's password
- On submit, call `supabase.auth.signInWithPassword({ email, password })` to verify
- If successful, call `switchTenant(pendingTenantSwitch)` and close dialog
- If failed, show error toast

**New state variables:**
- `pendingTenantSwitch` (uuid | null)
- `switchPassword` (string)
- `switchLoading` (boolean)

**New dialog:** A simple `Dialog` with password input and confirm/cancel buttons, rendered at the bottom of AppLayout.

### Files Changed

- **`src/components/AppLayout.jsx`** -- add tenant badge in header + password confirmation dialog for tenant switching

### No database or migration changes needed

