

## Restrict Home Cell Leaders to Their Own Cell Attendance

### Problem
Home Cell (WSF) leaders currently have no specific access to the Attendance page — they can't create or see WSF Meeting sessions for their cell. They should be able to create "WSF Meeting" sessions only for their assigned centre(s) and only see those sessions.

### Changes

#### 1. Database — Helper function + RLS policies

Create a `is_wsf_leader_for_session` function that checks if a user is the `leader_id` of a `wsf_centres` row matching the session's `unit` field:

```sql
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_session(
  _user_id uuid, _unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wsf_centres wc
    WHERE wc.leader_id = _user_id
      AND wc.tenant_id = _tenant_id
      AND lower(wc.name) = lower(COALESCE(_unit, ''))
  )
$$;
```

Add new RLS policies on `attendance_sessions`:
- **WSF leaders can manage WSF sessions** — `session_type = 'WSF Meeting' AND is_wsf_leader_for_session(auth.uid(), unit, tenant_id)`

Add new RLS policies on `attendance_records`:
- **WSF leaders can manage WSF session records** — join through `attendance_sessions` to verify `session_type = 'WSF Meeting'` and centre match

#### 2. Frontend — `src/hooks/useAuth.jsx`

Fetch the user's WSF centre names (where `leader_id = userId`) and expose as `leaderCentres` array, similar to `leaderUnits`.

#### 3. Frontend — `src/pages/Attendance.jsx`

- Import `isWSFLeader` and `leaderCentres` from `useAuth()`
- Update `canManage` to include `isWSFLeader`
- Add `isWSFLeaderOnly = isWSFLeader && !isAdmin && !isUnitLeader` flag
- **Session filtering**: WSF-only leaders see only sessions where `session_type === "WSF Meeting"` AND `unit` matches one of their `leaderCentres`
- **Session creation**: Lock type to "WSF Meeting" for WSF-only leaders, restrict unit/centre selection to their assigned centres
- Combined leaders (both unit + WSF) see both their unit meetings and WSF meetings

### Files Changed
- **New migration** — `is_wsf_leader_for_session` function + RLS policies
- `src/hooks/useAuth.jsx` — fetch and expose `leaderCentres`
- `src/pages/Attendance.jsx` — filtering and creation restrictions for WSF leaders

