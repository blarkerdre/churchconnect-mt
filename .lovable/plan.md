## Why Romoke can't see children

Romoke Odunsi is a **Children Church member** (her `members.church_unit` contains "Children Church"), but she is **not** a Children Church *leader* (no row in `unit_leader_assignments`).

The Check-in tab in `src/pages/ChildrenChurch.jsx` is **search-only** — it shows nothing until the user types 2+ characters of a parent/child name. The "All children" browse tab is gated behind `isLeader || isAdmin`, so Romoke never sees a list of children even though RLS (`is_children_church_member`) would allow it. There are 11 active children in the tenant and she has full SELECT permission on them; the data just isn't being rendered.

So this is a UX gap, not a permissions bug.

## Fix

Make the Children Church Check-in screen browsable for any Children Church worker, not only leaders.

1. **`src/pages/ChildrenChurch.jsx`**
   - In `CheckInPanel`, when the search box is empty, show a "Recent / all active children" list grouped by family (reuse the same fetch logic as `AllChildrenPanel`, limited to active children) so workers can tap a family directly instead of needing to type a name.
   - Add a short empty-state hint above the search field: *"Type a parent or child name, or pick a family below."*
   - Show the "All children" tab to Children Church members too (change the gate from `isLeader || isAdmin` to `isLeader || isAdmin || isChildrenChurchMember`), keeping the "Report" tab leader/admin-only. Detect membership with the existing `useUnitMembership("Children Church")` hook already used in `AppLayout`.

No database, RLS, or edge-function changes needed — RLS already allows Children Church members to read children.

## Out of scope

- Promoting Romoke to a Children Church leader (separate admin action in User Management if desired).
- Any changes to pickup, reports, or check-in PIN flow.
