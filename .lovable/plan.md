## What's actually happening

Even though the User Management UI shows Blarker Dre with no leader role, the database table `unit_leader_assignments` contains a row tying their user to `unit_name = 'Children Church'` (created 2026-06-18, tenant WCI Cardiff).

The gate in `src/pages/ChildrenChurch.jsx` calls the `is_children_church_leader` RPC, which simply checks for any row in `unit_leader_assignments` whose `unit_name` matches Children Church variants. That row makes the RPC return `true`, so Blarker sees the **All children** and **Report** tabs.

So this is a stale data row, not a code bug. (They also have a leftover `Transport` leader row from 2026-06-19 — likely from the same earlier assignment flow.)

## Plan

1. Delete the stale `unit_leader_assignments` row for Blarker Dre / Children Church via a migration:
   - `user_id = 3de7de27-3af9-499b-9fe3-d4dea1e47de9`
   - `tenant_id = d8bbbdae-d9b3-4999-912d-3aa5999884b0`
   - `unit_name ILIKE 'children%'`
2. Leave the Transport leader row alone unless you confirm it's also stale (say the word and I'll include it).
3. No code changes. After the migration, Blarker will only see **Check-in** and **Pickup** in Children Church.

## Why this is a one-off cleanup, not a logic change

The current rule "any leader assignment row for the Children Church unit → leader" matches what User Management writes today. Changing the logic would risk hiding the Report tab from legitimate leaders. If you'd rather harden the rule (e.g. require the user to *also* be an active unit member, or require an explicit role flag), tell me and I'll switch to that approach instead.
