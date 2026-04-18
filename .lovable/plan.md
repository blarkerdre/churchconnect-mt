
User reports the Users tab in TenantUsersDialog shows "No users in this tenant yet" but the Invitations tab shows an accepted invitation for `blarkerdre@yahoo.com`. So the membership exists but isn't showing.

Let me check the query — `tenant_memberships` joined with `profiles!inner(...)`. The `!inner` is the smoking gun: if a member has a `tenant_memberships` row but no matching `profiles` row, the inner join silently drops them.

Let me verify by querying the DB.
