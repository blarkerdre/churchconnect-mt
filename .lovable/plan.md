# Restrict "Church Unit" sidebar to unit members

## Problem
In `src/components/AppLayout.jsx` (line 47), the "Church Unit" nav item is defined with `access: null`, which makes it visible to every signed-in user. Members who don't belong to any church unit still see the link and can navigate to a page that isn't relevant to them.

## Fix
Gate the item behind a new `"unit"` access rule that returns true only for:
- Admins / Super Admins
- Unit Leaders (`leaderUnits.length > 0`)
- Reports Officers (consistent with other module gates)
- Members whose profile has a non-empty `church_unit` (i.e. they belong to at least one unit)

### Changes in `src/components/AppLayout.jsx`
1. Change the nav entry to `access: "unit"`.
2. In the access switch (around lines 146–157), add:
   ```js
   if (item.access === "unit")
     return isAdmin || isSuperAdmin || isReportsOfficer
       || (leaderUnits?.length > 0)
       || hasChurchUnit;
   ```
3. Derive `hasChurchUnit` from the current user's member record. `useAuth` already exposes the session; read `myMember?.church_unit` from the same source `MemberDashboard` uses, or add a small `useQuery` in `AppLayout` that selects `church_unit` from `members` for the current `user_id` + `tenant_id`, treating any non-empty, non-"None" value as `true`.

No changes to the `/church-unit` route itself — this is purely a sidebar visibility fix, matching how other module links (Children Church, Teens, WSF) are already gated.

## Out of scope
- Page-level guard on `/church-unit` (existing tabs already enforce their own permissions).
- Any DB/RLS changes.
