

## Diagnosis

I checked the database for `blarkerdre@yahoo.com`:

- ✅ Confirmed as **owner** of `Demo Church (TEST)` (tenant `d8bbbdae-…`)
- ✅ RLS policy `Tenant admins can manage memberships` (USING + WITH CHECK = `is_tenant_admin(auth.uid(), tenant_id)`) **allows owners to UPDATE roles**
- ✅ `is_tenant_admin()` returns `true` for both `owner` and `admin` roles
- ✅ No recent Postgres ERROR / RLS denial logs from this user

So the database is not blocking him. The block is in our **client-side flow** that we added in the last change. Reviewing `TenantUsersDialog.jsx`, I found three concrete reasons an owner cannot complete a role change:

### Reason 1 — Password re-auth almost always fails for tenant owners on this project
The confirm dialog calls:
```js
supabase.auth.signInWithPassword({ email: user.email, password })
```
Per `mem://infrastructure/email`, this is a multi-tenant project where many owners signed up via **invitation / magic link** and **never set a password**. They have no password to enter, so verification fails and the role change is silently aborted.

### Reason 2 — `signInWithPassword` rotates the JWT mid-action
Even when the password is correct, `signInWithPassword` issues a new session. The subsequent `updateRoleMutation` runs against a freshly-rotated token in the same tick, which sometimes lands before React Query's `supabase` client has the new auth header — producing a silent no-op or a misleading error toast.

### Reason 3 — The Select dropdown is "controlled" by `m.role` but never reverts on cancel
When the user picks "Admin" in the dropdown, `requestAction` is called but the visual selection stays on "Admin". If the user cancels the confirm dialog (or the password fails), the dropdown still **looks** like "Admin" while the DB row remains "Member" — making it appear "I already changed it but it didn't save."

## Fix

Replace the password re-auth gate with a lightweight **typed-confirmation** pattern that works for every owner regardless of how they signed up, and harden the dropdown lifecycle.

### Edit `src/components/tenants/TenantUsersDialog.jsx`

1. **Drop password re-auth.** Remove `confirmPassword`, `verifying`, and the `signInWithPassword` call.
2. **Add typed confirmation for high-risk actions only:**
   - Promote to **Owner** → require typing `PROMOTE`
   - **Remove** user → require typing `REMOVE`
   - Member ↔ Admin (both directions) → keep the warning dialog, but no typed token (single Confirm click)
   - Demote owner → require typing `DEMOTE`
3. **Fix the Select control** so that on cancel/close the dropdown visually reverts. Use a `key={m.role + pendingAction?.membership?.id}` trick or render the Select's `value` from `pendingAction` only while open; on close, force a re-render so it snaps back to the actual `m.role`.
4. **Keep** the warning copy / severity styling already in place.
5. **Toast on success/failure** of the underlying mutation as today (no change).

### Why this resolves Blarker's issue
- He no longer needs a password he may not have.
- The role change dispatches against the **existing** session, no JWT rotation race.
- If he cancels mid-flow, the dropdown reflects reality.

### Out of scope
- Audit logging of role changes (separate suggestion already offered)
- Re-introducing password re-auth as an optional "extra security" toggle
- Any DB or RLS change (none needed)

### Files
**Edit**
- `src/components/tenants/TenantUsersDialog.jsx`

