## Why Danger Zone is hidden

In `src/pages/Settings.jsx` (line 1609), the Danger Zone tab (and its content) is gated by:

```js
const canOwnerOnly = isSuperAdmin || isTenantOwner;
```

Only Super Admins and the Tenant **Owner** see the tab. Tenant Admins, Unit Leaders, and Members do not — this is intentional to protect destructive actions (data wipes, tenant deletion, backups).

## Decision

Keep the current gating: **Owner + Super Admin only**. No code changes.

## What to do to access it

- Sign in as the Tenant Owner for this tenant, or as a Super Admin.
- If you believe you are the Owner but still can't see the tab, the `tenant_users.role` for your user on this tenant is likely `admin` rather than `owner`. A Super Admin can update it in Tenant Admin → Users, or ask me to investigate and I'll check your role assignment.
