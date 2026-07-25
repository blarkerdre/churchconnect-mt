
## Goal

Right now most unit-scoped views are gated to unit **leaders** and admins. A plain member who belongs to a unit (via `members.church_unit`) can't see who else is in their unit, what tasks their unit has, or their unit's meeting/attendance history. This plan extends existing leader-scoped views to include unit members in a read-only capacity, using the church units listed on their own member record.

Special-purpose units (Children Church, Teens Church, Follow-up, Training Rep, Home Cell, Altar Ministry) already have their own member-vs-leader logic — this plan leaves those alone and only touches generic church units.

## Scope

For any user whose `myMember.church_unit` lists one or more units (comma-separated), and who is not already an admin/leader, they get:

1. **Members page** — see members whose `church_unit` overlaps with theirs (read-only, same filtering path currently used for unit leaders).
2. **Church Unit → Unit Tasks tab** — visible; shows tasks whose `unit_name` is one of their units. No create/edit/delete; assignment-level actions (acknowledge/complete on their own assignment) unchanged.
3. **Church Unit → Meetings & Attendance tab** — visible; shows only `Unit Meeting` sessions whose `unit` matches one of their units. Read-only (no create/close/edit). Self check-in widget is unchanged.
4. **Sidebar** — the existing `hasChurchUnit` gate for "Church Unit" already covers this; no change needed beyond confirming both tabs render for members.

Write access stays limited to admins and unit leaders. No RLS changes — current policies already allow tenant-scoped reads of `members`, `unit_tasks`, and `attendance_sessions` for authenticated users; the change is purely UI filtering.

## Technical details

- **`src/hooks/useAuth.jsx`** — add a derived `myUnits: string[]` (parsed from `myMember.church_unit`, trimmed, lowercased-comparable) exposed alongside `leaderUnits`. This becomes the single source for "units I belong to".
- **`src/pages/Members.jsx`** — extend `unitLeaderReadOnly` filter path: if user is a plain member with `myUnits.length > 0` and not admin, apply the same overlap filter using `myUnits` instead of `leaderUnits`. Keep edit buttons hidden (only own profile editable, as today).
- **`src/pages/UnitTasks.jsx`** — allow render when `myUnits.length > 0` even if `!canLead`. Compute `allUnits = isAdmin ? all : (leaderUnits ∪ myUnits)`. Hide "New Task", "Roster", "Report" buttons and per-task edit/delete for non-leaders. "My assignments" section unchanged.
- **`src/pages/Attendance.jsx`** — add a `isUnitMemberOnly` branch (not admin, not leader, `myUnits.length > 0`) that filters `sessions` to `session_type === "Unit Meeting"` with `unit` in `myUnits`, and hides create/close/edit controls.
- **`src/pages/ChurchUnit.jsx`** — no change; both tabs already render.
- **`src/components/AppLayout.jsx`** — no change; existing `hasChurchUnit` gate is correct.

## Out of scope

- Follow-ups, pastoral care, communications recipient scoping (already have their own rules).
- Any RLS/policy changes.
- Special units listed above.
