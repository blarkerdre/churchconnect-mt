

## Fix: `members_user_id_fkey` Foreign Key Violation

### Root cause

The `members.user_id` column has a foreign key constraint `REFERENCES auth.users(id) ON DELETE SET NULL`. The error occurs when code tries to insert or update a member row with a `user_id` that doesn't exist in `auth.users`. Two scenarios trigger this:

1. **`admin-create-user` reuse path**: When `createUser` fails with "already been registered", the function calls `listUsers()` and searches by email. If the auth user was previously deleted (via `admin-delete-user`), the user may no longer exist but could still appear transiently, or the function may match a stale profile entry.

2. **Manual account linking in MemberFormDialog**: The "Link Account" feature looks up a `profiles.user_id` by email. If the profile row exists but the referenced `auth.users` row has been deleted, the FK check fails when writing that `user_id` into `members`.

### Fix

**1. `supabase/functions/admin-create-user/index.ts`** — After resolving `userId` (both new and reused paths), verify the user actually exists in `auth.users` before inserting into `members`:

```ts
// After getOrCreateAuthUser, verify user exists
const { data: verifyUser, error: verifyError } = await supabase.auth.admin.getUserById(userId);
if (verifyError || !verifyUser?.user) {
  return jsonResponse({ error: "Auth user could not be verified" }, 400);
}
```

**2. `src/components/members/MemberFormDialog.jsx`** — In `handleLinkAccount`, add a verification step: after finding the profile by email, confirm the `user_id` is still valid by checking auth before updating the member. Since we can't call `admin.getUserById` from the client, we should verify via a lightweight edge function call or at minimum catch the FK error gracefully:

```js
// In linkAccountMutation.onError, show a clear message
onError: (err) => {
  const msg = err.message?.includes("members_user_id_fkey")
    ? "The selected user account no longer exists. It may have been deleted."
    : err.message;
  toast({ title: "Error linking account", description: msg, variant: "destructive" });
}
```

**3. `MemberFormDialog.jsx` payload fix** — Add the missing `workers_in_training` and `worshipped_at_other_wci` fields to the save payload (secondary fix to prevent data loss):

```js
workers_in_training: form.workers_in_training ?? false,
worshipped_at_other_wci: isFirstTimerOrNewConvert ? form.worshipped_at_other_wci : null,
```

### Files changed
- `supabase/functions/admin-create-user/index.ts` — verify auth user exists before member insert
- `src/components/members/MemberFormDialog.jsx` — better FK error messaging + add missing fields to payload

