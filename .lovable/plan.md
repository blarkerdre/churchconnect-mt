

## Fix: Follow-up Unit Members Seeing "Unknown" for Assigned Names

### Root Cause

Loveth and Favour have the `member` role (not `unit_leader`). They can see followups assigned to them via the RLS policy `auth.uid() = assigned_to`, but the **joined member data** (`members(first_name, last_name, ...)`) returns `null` because the `members` table RLS only allows SELECT for admins, unit leaders, or the member viewing their own record.

Since Loveth can't SELECT Shola Phillips' member row, the join returns `null` → "Unknown".

### Solution

Add an RLS policy on the `members` table that allows a follow-up assignee to read the member record linked to their assigned followup. This uses a subquery: "allow SELECT on members where there exists a followup assigned to the current user referencing this member_id."

### Changes

#### 1. Database migration — new RLS policy on `members`

```sql
CREATE POLICY "Assigned followup users can view followup member"
ON public.members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.followups f
    WHERE f.member_id = members.id
      AND f.assigned_to = auth.uid()
      AND f.tenant_id = members.tenant_id
  )
  AND user_has_tenant_access(tenant_id)
);
```

This lets any user who is `assigned_to` a followup see the member record that followup references — scoped to the same tenant.

### No code changes needed

The query in `Followups.jsx` already joins `members(first_name, last_name, email, phone, membership_status)`. Once RLS permits the SELECT, the join will return the member data and "Unknown" will be replaced with the actual name.

### Files changed
- Database migration — add RLS policy on `members` table

