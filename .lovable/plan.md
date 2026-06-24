# Orphan unit references — findings and proposed cleanup

## What I scanned
Joined every table that stores a free-text `unit_name` / `church_unit` against `church_units.name` (case-insensitive, per tenant): `unit_leader_assignments`, `unit_join_requests`, `unit_tasks`, `unit_task_groups`, `members.church_unit` (CSV-split).

## Results

### Clean (zero orphans)
- `unit_leader_assignments`
- `unit_tasks`, `unit_task_groups`

### Orphans found

**Demo tenant** `d8bbbdae… (Demo Church TEST)`
| Table | Stale value | Rows | Likely intent |
|---|---|---|---|
| `members.church_unit` | `Children` | 1 | rename → `Children Church` |
| `members.church_unit` | `Church Admin` | 1 | unknown — closest unit is `Church Office` |
| `unit_join_requests` | `Children` | 1 | rename → `Children Church` |

**Production tenant** `95e53cc3… (WCI Cardiff)`
| Table | Stale value | Rows | Likely intent |
|---|---|---|---|
| `members.church_unit` | `Urshering` (typo) | 7 | rename → `Ushering` |

Other `unit_join_requests` rows with NULL `unit_name` (12 total) are not orphans — `unit_name` is nullable on that table and means "general join request".

## Why these need your judgement, not a blind delete
`members.church_unit` is a comma-separated string of the units a member belongs to. Deleting an entry removes the member from that unit; renaming preserves the relationship. The fix is a **rename**, not a delete.

## Proposed actions (one `supabase--insert` call, all UPDATEs)

1. **Production typo fix** — for every member in tenant `95e…` whose `church_unit` CSV contains `Urshering`, replace the token with `Ushering` (regex-safe, preserves other tokens, dedups whitespace).
2. **Demo "Children" → "Children Church"** — same CSV-safe rename in `members.church_unit` AND update the matching `unit_join_requests.unit_name` row.
3. **Demo "Church Admin"** — leave alone and surface it to you. I won't guess a mapping. After you confirm (drop it, rename to "Church Office", or add a new "Church Admin" unit), I'll do the corresponding action.

## Prevention (out of scope unless you want it)
Long-term, `members.church_unit` as a free-text CSV is what allowed these to drift. A normalised `member_units` join table with FKs to `church_units` would make renames atomic and orphans impossible. Flag if you want this as a follow-up.

## Deliverable
A single data-only operation that performs (1) and (2). Then I'll ask you about (3) before touching it.
