

## Fix: Persist Disabled User Status Across Refreshes

### Problem
The `disabledUsers` state is a client-side `useState({})` that resets on every page load. The `admin-toggle-user` edge function correctly bans/unbans users in `auth.users`, but the UI never reads back `banned_until` from the database.

### Solution
Create a new edge function `admin-list-banned-users` that returns the list of banned user IDs from `auth.users`, then call it on page load to initialize `disabledUsers`.

### Changes

1. **New edge function `supabase/functions/admin-list-banned-users/index.ts`**
   - Verify caller is admin (same pattern as other admin functions)
   - Use `supabase.auth.admin.listUsers()` to get all users
   - Return an array of user IDs where `banned_until` is set and in the future
   - Return as `{ banned_user_ids: string[] }`

2. **`src/pages/UserManagement.jsx`**
   - Add a `useQuery` that calls the `admin-list-banned-users` edge function on mount
   - Initialize `disabledUsers` state from the query result instead of empty `{}`
   - Remove the manual `setDisabledUsers` in `toggleUserMutation.onSuccess` and instead invalidate the banned-users query so it refetches

### Technical Details
- The edge function pages through `listUsers` (default limit 1000) to handle larger user bases
- Uses the same CORS headers and admin verification pattern as existing edge functions
- The query key `["banned-users"]` is invalidated after toggle so UI stays in sync

