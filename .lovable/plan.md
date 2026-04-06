

## Fix: Restrict `scheduled_communications` SELECT to Admins/Leaders

### Problem
The original migration created a SELECT policy (`"Tenant members can view scheduled communications"`) that allows **any** tenant member to read all scheduled/draft messages, including recipient filters, message content, and error logs. A later migration tightened INSERT/UPDATE/DELETE to admins but left the SELECT policy untouched.

### Solution
Drop the overly permissive SELECT policy and replace it with one restricted to admins and leaders only.

### Migration SQL
```sql
DROP POLICY IF EXISTS "Tenant members can view scheduled communications"
  ON public.scheduled_communications;

CREATE POLICY "Admins/leaders can view scheduled communications"
  ON public.scheduled_communications
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid(), tenant_id)
    OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
  );
```

### Files changed
- **Database migration** — drop permissive SELECT policy, create admin/leader-only SELECT policy on `scheduled_communications`

