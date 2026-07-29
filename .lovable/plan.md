## Answer: no change needed

The Danger Zone tab in Settings is intentionally restricted. In `src/pages/Settings.jsx`:

- `canOwnerOnly = isSuperAdmin || isTenantOwner` (line 1609)
- The Danger Zone tab and its content are rendered only when `canOwnerOnly` is true (line 1773+)

So a tenant **admin** does not see it — only the tenant **owner** or a **super admin**. This protects destructive actions (tenant data deletion, backup/recovery).

You chose to leave the behaviour as-is, so no code changes will be made. If you need Danger Zone access on your current account later, the options are to sign in as the tenant owner/super admin, or transfer tenant ownership to your account.