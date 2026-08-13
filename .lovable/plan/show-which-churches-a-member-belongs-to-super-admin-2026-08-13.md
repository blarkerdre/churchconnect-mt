# Show which churches a member belongs to (Super Admin)

Super Admins currently see users only within the church they are viewing, so there is no way to tell that a person also belongs to another church.

## What changes

- In **User Management**, each user row gains a "Churches" line listing every church that user belongs to, with their role in each (Owner / Admin / Member). The current church is highlighted.
- In **Members**, the member list/detail for a linked account shows the same church badges next to the person's name.
- Both are visible to Super Admins only; other admins see the page exactly as today.
- Users with no other church memberships simply show their current church, so nothing looks broken.

## Technical notes

- Access is already permitted: `tenant_memberships` has a "Super admins can view all tenant memberships" select policy, and tenant names come from the joined `tenants` row — no migration or policy change needed.
- Add a Super-Admin-only React Query in `src/pages/UserManagement.jsx` that fetches `tenant_memberships (user_id, role, tenants(id, name, slug))` for the user IDs already loaded on the page, and renders the badges in the existing user card.
- Add the same lookup, keyed on `members.user_id`, in `src/pages/Members.jsx` and render badges in the member row for linked accounts.
- Extract the badge rendering into a small shared component (e.g. `src/components/tenants/UserChurchBadges.jsx`) so both pages stay consistent.
- Query is gated with `enabled: isSuperAdmin && ids.length > 0`, so no extra requests for regular admins.
