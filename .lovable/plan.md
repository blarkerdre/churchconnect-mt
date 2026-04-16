

The user wants archiving tenants to require password confirmation, like the permanent delete action already does in `archive-tenant/index.ts`.

Currently in `archive-tenant/index.ts`:
- `action: "archive"` → no password required
- `action: "restore"` → no password required  
- `action: "delete"` → password required (re-auths via anon client)

Need to add the same password re-auth check to the `archive` action. Restore is less destructive (reversible) — should I include it too? Archiving hides the tenant and locks members out, which is impactful enough to warrant the password. Restore just undoes archive, so safer. I'll require password for archive only, matching user's request literally.

Need to find where archive is called from the frontend to add the password prompt UI.

## Plan: Require Password for Tenant Archival

### Backend
**`supabase/functions/archive-tenant/index.ts`**:
- In the `action === "archive"` block, add the same password re-authentication check used by `delete`:
  - Require `password` in request body (return 400 if missing)
  - Use a separate anon client to call `signInWithPassword({ email: caller.email, password })`
  - Return 403 "Invalid password. Archive aborted." on failure
  - Only proceed with the archive update if auth succeeds
- Restore action remains password-free (reversible, low risk)

### Frontend
Locate the UI that triggers archive (likely in `src/pages/TenantAdmin.jsx` or a related dialog) and:
- Add a password input field to the archive confirmation dialog (mirroring the delete confirmation pattern)
- Pass `password` in the `supabase.functions.invoke("archive-tenant", { body: { tenant_id, action: "archive", password } })` call
- Show error toast if backend returns 403

### Files Changed
- `supabase/functions/archive-tenant/index.ts` — add password verification to archive branch (~15 lines)
- `src/pages/TenantAdmin.jsx` (or the dialog component currently handling archive) — add password input + pass it through (~20 lines)

