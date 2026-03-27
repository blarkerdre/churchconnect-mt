

## Remove `claim_own_member_profile` RPC

### Why

This function auto-links authenticated users to unlinked member records by email. It was already replaced by the tenant-scoped `auto_link_member_by_email` RPC for admin flows. The self-claim path is a security risk — it allows any authenticated user to silently claim any unlinked member record matching their email across tenants (even with the tenant-scoped fix, it relies on the caller's tenant context which may not be reliable).

### Changes

**Database migration:**
- `DROP FUNCTION IF EXISTS public.claim_own_member_profile();`

**`src/hooks/useAuth.jsx` (~lines 68-85):** Remove the `claim_own_member_profile` call block. If no member is found by `user_id`, just set `myMember` to `null` — don't attempt auto-claiming.

**`src/pages/MyProfile.jsx` (~lines 145-156):** Remove the `claim_own_member_profile` fallback. If no member found by `user_id`, return `null`.

### Files changed

- **One database migration** — drop the function
- **`src/hooks/useAuth.jsx`** — remove claim block
- **`src/pages/MyProfile.jsx`** — remove claim fallback

