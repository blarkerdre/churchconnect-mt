

# Unit-Specific Leader Assignment

## Problem
The current `unit_leader` role grants leader-level access but doesn't specify **which unit** the person leads. A member in multiple units who is made a unit leader gets leader permissions broadly.

## Solution
Add a `unit_leader_assignments` table that maps a user to the specific unit(s) they lead, and update the User Management UI to allow admins to assign unit leadership per unit.

## Database Changes

**New table: `unit_leader_assignments`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL) — references auth.users
- `unit_name` (text, NOT NULL) — e.g. "Transportation", "Pastoral Care", "WSF"
- `created_at` (timestamptz)
- Unique constraint on (user_id, unit_name)
- RLS: admins can manage, users can view own assignments

## UI Changes

**User Management page (`src/pages/UserManagement.jsx`)**
- When a user's role is set to `unit_leader`, show a multi-select or chip selector for which unit(s) they lead (Transportation, Pastoral Care, Ushering, Media, Protocol, Choir, etc.)
- Display assigned units as badges next to their role

## Permission Logic Updates

**`src/hooks/useAuth.jsx`**
- Fetch `unit_leader_assignments` alongside roles
- Expose `leaderUnits` array in auth context (e.g. `["Transportation"]`)

**Module-specific access** (Transportation, Pastoral Care, Communications, WSF)
- Update unit-specific permission checks to verify the user leads that particular unit, not just that they have the `unit_leader` role
- Admins/Super Admins bypass this check as before

## Files to Change
1. **Migration SQL** — create `unit_leader_assignments` table with RLS
2. **`src/hooks/useAuth.jsx`** — fetch and expose `leaderUnits`
3. **`src/pages/UserManagement.jsx`** — add unit assignment UI when role is `unit_leader`
4. **`src/pages/Transportation.jsx`** — check `leaderUnits.includes("Transportation")`
5. **`src/pages/PastoralCare.jsx`** — check `leaderUnits.includes("Pastoral Care")`
6. **`src/pages/Communications.jsx`** — scope broadcasts to led units
7. **`src/pages/WSFManagement.jsx`** — check `leaderUnits.includes("WSF")`

