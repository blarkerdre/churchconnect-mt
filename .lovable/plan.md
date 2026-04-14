

## Restrict Leaders to Only Their Members

### Problem
Currently, **unit leaders** see all members in the tenant (the RLS SELECT policy grants full access to `unit_leader`). **Home Cell leaders** are already restricted at the DB level to members with a matching `wsf_centre_id`, but the frontend query fetches all members indiscriminately for any leader role, so it may still show all members if the RLS policy is too broad.

### Current State
- RLS on `members` table:
  - `"Admins and leaders can view all members"` — grants SELECT to `is_admin()` OR `has_role('unit_leader')` — **no unit filtering**
  - `"WSF leaders can view centre members"` — grants SELECT when `is_wsf_leader_for_centre(auth.uid(), wsf_centre_id)` — **already scoped correctly**
- Frontend (`Members.jsx`): leaders (`viewOnly = true`) run a query with no additional filters — they rely entirely on RLS

### Solution

#### 1. New Security Definer Function
Create `is_unit_leader_for_member(uuid, text, uuid)` — checks if the user has a `unit_leader_assignments` entry for any unit that appears in the member's comma-separated `church_unit` field.

```sql
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_member(
  _user_id uuid, _church_unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND position(lower(ula.unit_name) in lower(COALESCE(_church_unit, ''))) > 0
  )
$$;
```

#### 2. Replace the Broad SELECT Policy
Drop `"Admins and leaders can view all members"` and create two separate policies:

- **Admins can view all members** — `is_admin(auth.uid(), tenant_id)`
- **Unit leaders can view unit members** — `is_unit_leader_for_member(auth.uid(), church_unit, tenant_id) AND user_has_tenant_access(tenant_id)`

#### 3. Restrict the UPDATE Policy Similarly
The current update policy also grants full UPDATE to unit leaders. Replace it:

- **Admins can update members** — `is_admin(auth.uid(), tenant_id)`
- **Unit leaders can update unit members** — `is_unit_leader_for_member(auth.uid(), church_unit, tenant_id) AND user_has_tenant_access(tenant_id)`

#### 4. No Frontend Changes Needed
The frontend already delegates visibility to RLS. Leaders will automatically see only their relevant members.

### Technical Details
- One migration with: function creation, policy drops, policy creates
- The `position()` approach handles comma-separated `church_unit` values (e.g. "Follow-Up, Choir") matching against `unit_leader_assignments.unit_name`
- Home Cell leader visibility is already correct via the existing `is_wsf_leader_for_centre` policy — no changes needed there
- The INSERT policy for `unit_leader` remains unchanged (leaders can still register new members)

### Files Changed
- **New migration** — creates function + replaces RLS policies on `members`
- No code file changes required

