# Remove Blarker Dre's stale Transport leader row

## Finding
`unit_leader_assignments` contains one row for Blarker Dre:

- `user_id`: 3de7de27-3af9-499b-9fe3-d4dea1e47de9
- `tenant_id`: d8bbbdae-d9b3-4999-912d-3aa5999884b0
- `unit_name`: Transport
- `created_at`: 2026-06-19

You confirmed Blarker is not a designated unit leader. This row is stale (same pattern as the Children Church row removed earlier) and grants them Transport leader privileges (driver assignment views, transport reports scoped to the unit, etc.).

Blarker remains a regular Transport unit member (`members.church_unit` includes "Transport"), which is unaffected.

## Action
Single data deletion, no code changes:

```sql
DELETE FROM unit_leader_assignments
WHERE user_id = '3de7de27-3af9-499b-9fe3-d4dea1e47de9'
  AND tenant_id = 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'
  AND unit_name = 'Transport';
```

After this, Blarker will have zero rows in `unit_leader_assignments` and will see Transportation only with normal member access.

## Optional follow-up (not in this plan)
If stale leader rows keep appearing, we can audit how `UnitLeaderAssignments` writes are persisted (e.g. ensure removals delete the row rather than just clearing UI state). Say the word and I'll investigate separately.
