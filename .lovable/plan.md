# Why stale unit-leader rows appear, and how to stop them

## Root cause

`unit_leader_assignments` is the table that grants per-unit leader powers (e.g. `is_children_church_leader`, transport leader views, follow-up routing, pastoral-care routing). It is created in two places:

- `src/components/users/UnitLeaderAssignments.jsx` (inline per-user)
- `src/components/users/BulkUnitAssignDialog.jsx` (bulk)

Both insert rows when an admin assigns a user to a unit. **Nothing ever deletes them automatically.** Specifically:

1. **Removing the `unit_leader` role** in `src/pages/UserManagement.jsx` (line 135) deletes the `user_roles` row only. The user's `unit_leader_assignments` rows stay, and downstream checks (e.g. `is_children_church_leader`) only look at `unit_leader_assignments` — so the user keeps Children Church / Transport / etc. leader access even though they're no longer a unit leader.
2. **Demoting / changing a user's role** has the same gap.
3. **Removing a user from a church unit** (editing `members.church_unit`) does not touch `unit_leader_assignments`.
4. **Renaming or deleting a church unit** in `church_units` leaves orphan rows pointing at the old `unit_name` (free text, no FK).
5. **`is_*_leader` RPCs gate on the assignment row alone**, not on the current `unit_leader` role — so a stale row is enough to grant access.

This is exactly how Blarker Dre kept seeing Children Church and Transport leader UI after their role/unit was changed: the assignment rows from 2026-06-18/19 were never cleaned up.

## Fix plan

Two layers — defence in depth.

### 1. Cascade deletes when the `unit_leader` role is removed
In `src/pages/UserManagement.jsx` role-toggle mutation (else branch around line 135), after the `user_roles` delete for `role === 'unit_leader'`, also:

```js
await supabase
  .from("unit_leader_assignments")
  .delete()
  .eq("user_id", userId)
  .eq("tenant_id", tenantId);
```

Audit-log the cleanup count.

### 2. Server-side trigger as a safety net
Add a Postgres trigger so the data stays consistent even if a future caller bypasses the UI:

```text
AFTER DELETE ON public.user_roles
  WHEN OLD.role = 'unit_leader'
  -> DELETE FROM unit_leader_assignments
       WHERE user_id = OLD.user_id AND tenant_id = OLD.tenant_id;
```

This guarantees: no `unit_leader` role → no leader assignments, period.

### 3. One-off cleanup of existing stale rows
Run a single delete to remove every `unit_leader_assignments` row whose user no longer has the `unit_leader` role in the same tenant:

```sql
DELETE FROM unit_leader_assignments ula
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = ula.user_id
    AND ur.tenant_id = ula.tenant_id
    AND ur.role = 'unit_leader'
);
```

I'll first run this as a `SELECT` preview so you can confirm the row count and affected names before deletion.

### Out of scope (call out, don't change now)
- Orphan rows pointing at renamed/deleted `church_units.name` — separate cleanup, ask first.
- Whether `is_*_leader` RPCs should additionally require the live `unit_leader` role — the trigger makes this moot, but I can tighten the RPCs too if you want belt-and-braces.

## Deliverable order
1. Preview SELECT of stale rows.
2. Migration: trigger + one-off DELETE.
3. Code edit in `UserManagement.jsx` to cascade on role removal.
