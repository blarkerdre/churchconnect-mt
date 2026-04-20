

## Why unit leaders can't see pending join requests

### Root cause
Two issues, both client-side. The RLS and RPC functions are correct — unit leaders **already have permission** to see and approve unit join requests. But the UI never shows them the widget:

1. **Wrong dashboard branch.** In `src/pages/Dashboard.jsx`, a non-admin unit leader falls through to the `MemberDashboard` (line 96-98). The `<PendingJoinRequests />` widget is only mounted inside the **admin** dashboard (line 161) and inside `WSFLeaderDashboard` (with `filter="home_cell"`). `MemberDashboard` does not render it at all.

2. **Routing order.** Even if we add it to `MemberDashboard`, the order `isWSFLeader → MemberDashboard` means a user who is *both* a Unit Leader and a Home Cell leader would still get one dashboard only. We need the Unit Leader case handled explicitly.

### Fix (single file: `src/pages/Dashboard.jsx`)

Add a Unit Leader branch and ensure unit-only requests show:

```text
if isAdmin                 → admin dashboard (shows all join requests)
elif isUnitLeader && !isWSFLeader  → MemberDashboard + <PendingJoinRequests filter="unit" />
elif isWSFLeader && !isUnitLeader  → WSFLeaderDashboard (already shows home_cell)
elif isUnitLeader && isWSFLeader   → WSFLeaderDashboard + <PendingJoinRequests filter="unit" />
else                       → MemberDashboard
```

Concretely:

- Update the early-return block so a unit leader (non-admin) sees `MemberDashboard` **with** `<PendingJoinRequests filter="unit" />` rendered above it.
- In `WSFLeaderDashboard.jsx`, if the user is also a unit leader, additionally render `<PendingJoinRequests filter="unit" />` (the existing `filter="home_cell"` instance stays).

### Why no DB / RLS change is needed
- Policy `"Unit leaders view their unit join requests"` already grants SELECT to unit leaders for `request_type='unit'` rows matching their assigned `unit_name`.
- `count_pending_join_requests_for_user` and `approve_join_request` / `decline_join_request` RPCs already include the unit-leader path.
- The `usePendingJoinRequests` hook fetches all visible rows (RLS filters them); passing `filter="unit"` in the component already narrows display to unit requests.

### Out of scope
- No DB migration.
- No changes to `usePendingJoinRequests`.
- No changes to admin or member views.

### Verification after implementation
- Sign in as a user with `unit_leader` role only (no admin).
- Have a member submit a join request for that unit (via My Profile → request to join unit).
- Confirm the **Pending Join Requests** card appears on their dashboard with Approve / Decline working.
- Confirm a unit leader does **not** see Home Cell requests they don't own, and vice versa.
- Test at 384px width to confirm card buttons wrap cleanly.

