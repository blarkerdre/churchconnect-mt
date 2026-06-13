## Goal
Add the pickup delegation name to the Children Church report table and CSV export.

## Background
When a child is released via a one-time delegation code, the collector's name is stored in `child_pickup_delegations.delegate_name` and linked via `child_checkins.pickup_delegation_id`. The report currently shows:
- Brought by (drop-off adult)
- Collected by (member who picked up via PIN)
- But **not** the delegation name (non-member who collected via delegation code)

## Changes — `src/pages/ChildrenChurch.jsx` (`ReportPanel`)

### 1. Query: fetch delegation name
In the `child_checkins` query, add a join:
```
pickup_delegation:pickup_delegation_id(delegate_name)
```
After mapping worker names, compute:
```
_delegation_name: r.pickup_delegation?.delegate_name || r.notes?.replace(/^Delegate:\s*/, "") || ""
```
This uses the explicit `delegate_name` field when available, and falls back to parsing the legacy `notes` column for older records.

### 2. On-screen table: add "Delegated to" column
Insert a new `<th>` and `<td>` after "Collected by" in the sticky-header table:
- Header: **Delegated to**
- Cell: `{r._delegation_name || "—"}`

Update the `colSpan` on the empty-state row from `9` to `10`.

### 3. CSV export: add delegation column
Add `delegated_to` to the `headers` array (after `collected_by`).
Include `q(r._delegation_name)` in each data row.

## Out of scope
- No database schema changes.
- No changes to the check-in, pickup, or delegation-creation flows.
- No changes to notification logic.