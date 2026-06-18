## Goal
In **My Family**, restrict the "Show all tenant records" view to tenant admins only. Children Church workers will no longer see the toggle or the all-tenant children list — they will only see their own family (same as regular members).

## Change

**`src/pages/MyFamily.jsx`**
- Remove `isCCWorker` lookup (the `is_children_church_member` RPC call and its query).
- Change `const canSeeAll = isAdmin || isCCWorker;` to `const canSeeAll = isAdmin;`.
- The empty-state guard `if (!meMember && !canSeeAll)` keeps working: non-linked CC workers will now see the "contact an admin" message rather than the all-tenant browser.

## Out of scope
- No database/RLS changes. CC workers retain backend access to children via existing policies for check-in/pickup workflows; only the My Family UI toggle is removed for them.
- No changes to the GuardianManager, DelegationDialog, or check-in displays.