
## Fix Tenant Invite End-to-End

### What is actually broken
There are multiple issues in the current invite flow, not just one:

1. `invite-to-tenant` has a bug in the “already a member” branch:
   - it selects only `id` from `tenant_memberships`
   - but then checks `existingMembership.role`
   - so role-upgrade/idempotent logic is incomplete/broken

2. The edge function can return a partial-success payload like:
   - `success: true`
   - `email_warning: "..."`
   but the UI always shows only “Invitation sent” and does not surface the warning.

3. The Invitations tab has no visible error state.
   - If the read is blocked by policy or the query fails, the user just sees an empty tab / broken experience.

4. The current experience is too fragile around stale pending invites.
   - If an invite already exists, the function throws `400`
   - there is no resend/reuse flow, so the feature feels broken.

### What I would implement

#### 1) Harden the backend invite function
File: `supabase/functions/invite-to-tenant/index.ts`

Update the function so it behaves predictably in all cases:

- When checking existing memberships, select `id, role` instead of only `id`
- If the user is already in the tenant:
  - if role differs, update the role
  - return a success payload instead of error
- If a pending invite already exists:
  - do not hard-fail immediately
  - either:
    - reuse the existing pending invitation and resend email, or
    - update its role/timestamp and return success
- Keep returning structured results such as:
  - `auto_added`
  - `already_member`
  - `invitation_id`
  - `email_warning`
  - `reused_pending_invitation`

This makes the feature idempotent and prevents “invite feature not working” loops.

#### 2) Improve the Tenant Admin invite UI response handling
File: `src/components/tenants/TenantUsersDialog.jsx`

Update `inviteMutation.onSuccess` so it handles all success variants correctly:

- Show:
  - “User added to tenant” when `auto_added`
  - “User already belongs to this tenant” when `already_member`
  - “Invitation resent” when reusing an existing pending invitation
  - “Invitation created, but email failed” when `email_warning` is present

Also:
- keep invalidating:
  - `["tenant-users", tenant.id]`
  - `["tenant-invitations", tenant.id]`
  - `["tenant-stats"]`

This ensures the UI reflects what actually happened instead of always claiming success.

#### 3) Add proper loading/error/empty states for Invitations tab
File: `src/components/tenants/TenantUsersDialog.jsx`

Extend the invitations query handling to include:
- `isLoading`
- `isError`
- `error`

Then render:
- loading state
- clear error message if query fails
- empty state only when the query succeeds and returns no rows

This will make RLS/query issues visible instead of silently looking like “no pending invitation”.

#### 4) Verify and, if needed, tighten invitation RLS
Files:
- existing migration already present: `20260326232427_058547ff-0332-49ee-9523-bfbbc68b698d.sql`
- add a new migration only if the live policy still mismatches intended access

Current policies already appear intended to allow:
- tenant owners/admins
- super admins
to read/write `tenant_invitations`.

So I would not replace them blindly. I would only add a migration if implementation review shows the live behavior still differs. If a fix is needed, it should preserve:
- tenant-scoped admin access
- super admin global access
- user self-read / self-accept for their own invitation

#### 5) Optional but recommended: add resend/cancel actions
File: `src/components/tenants/TenantUsersDialog.jsx`
Possible backend reuse in `invite-to-tenant`

Add explicit UX for:
- Resend pending invitation
- Cancel pending invitation
- Promote existing user without treating it as a failed invite

This removes ambiguity and matches real admin expectations.

### Technical notes
```text
Current likely flow:
UI -> invite-to-tenant
   -> existing member? auto-add/role update path
   -> new user? create tenant_invitations row
   -> send transactional email
UI then refetches tenant_invitations
```

Key code issue found:
```text
existingMembership selects only "id"
but later reads existingMembership.role
```

So this line of logic is incomplete and should be corrected.

Also, the UI currently ignores structured success warnings:
```text
email_warning
already_member
```
That makes successful-but-imperfect backend results look broken to admins.

### Files to change
1. `supabase/functions/invite-to-tenant/index.ts`
2. `src/components/tenants/TenantUsersDialog.jsx`
3. Possibly one new migration only if invitation RLS truly needs correction after review

### Expected result after implementation
- inviting a brand-new email creates a visible pending invitation
- existing users can be added without confusing errors
- stale pending invites no longer block the workflow
- email-delivery problems are shown clearly
- the Invitations tab no longer fails silently
