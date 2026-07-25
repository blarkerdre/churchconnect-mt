## Diagnosis

Romoke Odunsi has `Children Church` in her `church_unit`, so `is_children_church_member` returns true and `checkin_child` would accept her. But she never gets that far: David Badero doesn't appear in her search on the Children Church page.

The reason is the RLS SELECT policy on `public.children`:

```
is_admin OR is_reports_officer
  OR is_child_primary_guardian OR is_child_co_parent
  OR is_child_active_today
```

There is no clause for Children Church workers/leaders. So a worker can only see a child once that child is already checked in today. Before drop-off, the search query in `ChildrenChurch.jsx` (`supabase.from("children").select(...)`) returns zero rows for non-guardian workers, and David never shows up.

Sibling tables have the same gap worth fixing in one pass:
- `child_guardians` SELECT — workers also need to see authorised adults for the drop-off screen.

`checkin_child`, pickup, and delegation flows already gate on `is_children_church_member`/`is_admin` and don't need changes.

## Plan

1. **Migration — add Children Church worker read access**
   - Drop and recreate the `children` SELECT policy to add:
     `OR public.is_children_church_member(auth.uid(), tenant_id)`
     (keeps admin, reports officer, guardian, co-parent, active-today clauses).
   - Drop and recreate the `child_guardians` SELECT policy the same way so the "Authorised adults" list on the drop-off panel loads for workers.

2. **Verify**
   - Re-run `SELECT policyname, qual FROM pg_policies` for both tables to confirm the new clause.
   - Confirm Romoke (as an authenticated user with `Children Church` in `church_unit`) can now find "David Badero" via the search box and complete drop-off.

No frontend code changes required — the existing search query and check-in mutation will start returning rows once RLS allows it.

## Technical notes

- Keep `WITH CHECK`/INSERT/UPDATE/DELETE policies untouched; this change only broadens SELECT.
- `is_children_church_member` already covers both unit members and leaders (via `unit_leader_assignments`), matching the whitelist that includes `children church`, `childrens church`, `children's church`, and the ministry variants — so no whitelist edits are needed this time.
