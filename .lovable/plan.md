

## Recover Super Admin Account

### What we'll do
1. **Create a temporary `recover-super-admin` edge function** that recreates the account `kugbiyiadeniyi@gmail.com` with a temporary password, confirms the email, creates a profile, and assigns the `super_admin` role.
2. **Configure it in `config.toml`** with `verify_jwt = false` (since no authenticated user exists).
3. **Deploy and invoke it once** to recreate the account.
4. **Delete the function immediately** after successful recovery.
5. **Hide the delete button** in the frontend so regular admins can't see it for super_admin users.

### Technical Details

**New file: `supabase/functions/recover-super-admin/index.ts`**
- Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.createUser()` with email `kugbiyiadeniyi@gmail.com`, a temporary password, and `email_confirm: true`
- Inserts a row into `user_roles` with role `super_admin`
- Protected by a hardcoded one-time recovery secret passed in the request body (to prevent random invocations during the brief window it's deployed)

**Edit: `supabase/config.toml`**
- Add `[functions.recover-super-admin]` with `verify_jwt = false`

**Edit: `src/pages/UserManagement.jsx` (line ~241)**
- Change delete button condition from `{!isCurrentUser && (` to `{!isCurrentUser && (isSuperAdmin || !userRoles.includes("super_admin")) && (`

### Post-recovery steps
1. Sign in with the temporary password
2. Change password immediately via the app
3. The recovery function will be deleted right after use

