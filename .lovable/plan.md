

## Restrict Unit Leaders to Their Own Unit Attendance

### Problem
Unit leaders can currently create meetings of any type and see all attendance sessions across the tenant. They should only be able to create "Unit Meeting" sessions for their assigned units and only see sessions belonging to their units.

### Changes

#### 1. Frontend — `src/pages/Attendance.jsx`
- **Session list filtering**: When `isUnitLeader && !isAdmin`, filter `sessions` to only show sessions where `session_type === "Unit Meeting"` AND `unit` matches one of the user's `leaderUnits`
- **Session creation dialog**: For unit leaders, lock the type to "Unit Meeting", auto-populate unit from `leaderUnits`, and restrict unit selection to only their assigned units (use the same pattern as `SessionFormDialog.jsx`)
- Import `leaderUnits` from `useAuth()`

#### 2. RLS — New migration on `attendance_sessions`
Replace the broad `"Admins/leaders can manage sessions"` ALL policy with:
- **Admins can manage all sessions** — `is_admin(auth.uid(), tenant_id)`
- **Unit leaders can manage their unit sessions** — checks that `session_type = 'Unit Meeting'` AND the session's `unit` field matches one of the user's `unit_leader_assignments`

Create a helper function:
```sql
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_session(
  _user_id uuid, _unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(ula.unit_name) = lower(COALESCE(_unit, ''))
  )
$$;
```

New policies:
- `"Admins can manage sessions"` ALL — `is_admin(auth.uid(), tenant_id)`
- `"Unit leaders can manage unit sessions"` ALL — `is_unit_leader_for_session(auth.uid(), unit, tenant_id) AND session_type = 'Unit Meeting'`
- Keep the existing `"Authenticated can view sessions"` SELECT policy (members need to see sessions for self-check-in)

#### 3. RLS — Scope `attendance_records` similarly
The current policy lets unit leaders view/manage ALL attendance records. Add unit scoping by joining through `attendance_sessions`:
- Drop `"Admins and leaders can view all attendance records"` and `"Admins/leaders can manage records"`
- Replace with admin-only full access and unit-leader scoped access (where the parent session's unit matches their assignment)

### Files Changed
- `src/pages/Attendance.jsx` — filter sessions, lock creation form for unit leaders
- New migration — helper function + replacement RLS policies on `attendance_sessions` and `attendance_records`

