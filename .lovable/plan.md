The user wants tenant switching to require password re-auth, similar to archive/delete. Memory `mem://auth/tenant-switching-security` confirms this is already a known pattern — let me verify current state.

I need to look at:

1. `src/contexts/TenantContext.jsx` — `switchTenant` function (currently no password)
2. Where `switchTenant` is called from UI (likely a tenant switcher dropdown in sidebar/header)

From the TenantContext shown in context, `switchTenant` is just:

```js
const switchTenant = useCallback((tenantId) => {
  const match = tenantMemberships.find(m => m.tenant_id === tenantId);
  if (match) setCurrentTenant(match);
}, [tenantMemberships]);
```

No password check. Need to find the UI caller.

## Plan: Require Password for Tenant Switching

### Approach

Mirror the archive/delete pattern: prompt for password in a dialog, re-authenticate via `signInWithPassword` using the current user's email, then proceed with the switch only on success.

### Changes

**1. `src/contexts/TenantContext.jsx**`

- Convert `switchTenant` to async and accept an optional `password` argument.
- When a password is provided, call `supabase.auth.signInWithPassword({ email: user.email, password })` first.
- If auth fails, throw an error so the caller can show a toast.
- If auth succeeds (or no password is required for same-tenant edge cases), proceed with `setCurrentTenant(match)` and navigate to the new tenant slug URL.

**2. Tenant Switcher UI** (likely in `src/components/AppLayout.jsx` or a dropdown component within it — will locate during implementation)

- Replace the direct `switchTenant(tenantId)` call with a confirmation dialog containing:
  - Target tenant name display
  - Password input field
  - "Switch" / "Cancel" buttons
- On submit, call `switchTenant(tenantId, password)` and:
  - Show error toast on `Invalid password`
  - Close dialog and navigate on success
- Skip the dialog if the user is switching to the tenant they're already on (no-op).

**3. Memory update**
The memory `mem://auth/tenant-switching-security` already states this is implemented — it appears the rule was set but the code may have drifted, or it was only partially wired. Implementation will bring code into alignment with the documented rule. No memory edit needed.

### Files Changed

- `src/contexts/TenantContext.jsx` — async `switchTenant` with password verification (~10 lines)
- `src/components/AppLayout.jsx` (or wherever the tenant switcher lives) — add password confirmation dialog (~40 lines)