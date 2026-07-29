## Why she sees nothing

Tayo (tjrotibi@yahoo.com) **is** a Children's Church unit leader (assignment added today), so the Report tab shows — but it's empty.

The cause is the row-level security rule on check-in records. Non-admin Children's Church workers can only read rows where `service_date = CURRENT_DATE`. The tenant's 64 check-in records run 14 Jun – 26 Jul 2026, and there are none for today, so the report returns zero rows. This restriction came from an earlier security hardening pass that intentionally narrowed worker reads to the current day; leaders were never carved out.

## Fix

Update the SELECT policy on child check-ins so it reads:

- admin / reports officer → all rows (unchanged)
- parent / co-parent of the child → their own child's rows (unchanged)
- **Children's Church unit leader → all rows for their tenant (new)**
- other Children's Church members (workers) → today only (unchanged)

This uses the existing `is_children_church_leader(auth.uid(), tenant_id)` helper, so no new functions are needed.

## Technical detail

Single migration replacing the `Child checkins select` policy:

```sql
DROP POLICY "Child checkins select" ON public.child_checkins;
CREATE POLICY "Child checkins select" ON public.child_checkins
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid(), tenant_id)
  OR is_reports_officer(auth.uid(), tenant_id)
  OR is_children_church_leader(auth.uid(), tenant_id)
  OR is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR is_child_co_parent(auth.uid(), child_id, tenant_id)
  OR (is_children_church_member(auth.uid(), tenant_id) AND service_date = CURRENT_DATE)
);
```

No frontend changes: the Report tab is already gated on leader-or-admin, and its query is tenant-scoped.

Note: for parity, the Teens Church report path can be checked the same way if you want it verified in this pass.
