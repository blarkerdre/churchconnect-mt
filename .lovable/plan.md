## Problem

The "Check In failed" toast appears because the RLS policy `Members can self check-in` calls `member_eligible_for_session(...)`, and that function **only returns true for Unit Meetings**. Any general session (Sunday Service, Special Service, Bible School, Prayer Meeting, Other) or Home Cell Meeting is rejected by RLS even though the UI offers a Check In button.

Current `member_eligible_for_session`:
```
WHERE s.session_type = 'Unit Meeting'
  AND s.unit IS NOT NULL
  AND lower(btrim(u)) = lower(btrim(s.unit))
```

This contradicts the new audience model in `SelfCheckInWidget` and `SessionFormDialog`, where a session with no `unit` should be visible to all members.

## Fix

Update the `member_eligible_for_session` SECURITY DEFINER function so a member is eligible when **any** of these is true:

1. **General session** — `s.unit IS NULL` and the member belongs to the same tenant as the session.
2. **Unit Meeting** — `s.session_type = 'Unit Meeting'`, `s.unit` set, and the unit appears in the member's `church_unit` CSV (case/whitespace-insensitive — current logic).
3. **Home Cell Meeting** — `s.session_type = 'Home Cell Meeting'`, `s.unit` set, and the member's `wsf_centre_id` resolves to a `wsf_centres.name` matching `s.unit` (case-insensitive). Also accept members in the same tenant where the centre name matches the unit string, in case the member is linked by name only.

All three branches must enforce `m.tenant_id = s.tenant_id` to keep tenant isolation strict.

## Implementation

Single migration that replaces the function:

```sql
CREATE OR REPLACE FUNCTION public.member_eligible_for_session(_member_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_sessions s
    JOIN public.members m
      ON m.id = _member_id
     AND m.tenant_id = s.tenant_id
    LEFT JOIN public.wsf_centres c
      ON c.id = m.wsf_centre_id
    WHERE s.id = _session_id
      AND (
        -- 1. General session: visible to all tenant members
        s.unit IS NULL
        -- 2. Unit Meeting matching one of the member's units
        OR (
          s.session_type = 'Unit Meeting'
          AND s.unit IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM unnest(string_to_array(coalesce(m.church_unit, ''), ',')) AS u
            WHERE lower(btrim(u)) = lower(btrim(s.unit))
          )
        )
        -- 3. Home Cell Meeting matching the member's assigned centre
        OR (
          s.session_type = 'Home Cell Meeting'
          AND s.unit IS NOT NULL
          AND lower(btrim(c.name)) = lower(btrim(s.unit))
        )
      )
  );
$$;
```

No code changes required — the widget and dialog are already aligned. After this migration, members can self check-in to:

- Any general/all-members session (Sunday Service, Special Service, Bible School, Prayer Meeting, Special Event, Other)
- Unit Meetings for units they belong to
- Home Cell Meetings for the centre they're assigned to

## Files

- New migration replacing `public.member_eligible_for_session`
- No frontend changes
