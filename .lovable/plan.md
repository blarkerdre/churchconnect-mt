

User asks why tenant owners can't give users admin role. This is a diagnostic/research question, not an implementation request. Let me investigate before answering.

I need to check:
1. The role update mutation in TenantUsersDialog
2. RLS on tenant_memberships for UPDATE
3. The is_admin / has_role functions

Let me look at the actual RLS to see if there's a restriction blocking admins/owners from updating roles.
