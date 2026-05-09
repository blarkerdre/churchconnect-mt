## Problem

Growth Milestones on the Dashboard shows nonsensical ratios like `12 / 9 (100%)` for Water Baptism. The denominator was already switched to **Active members only** (e.g. 9 for demo-test), but the numerator still counts **all members** (Active + Inactive + First Timer + Visitor + …) via the `get_dashboard_stats` RPC.

Verified with current data:

| Tenant | Active | WB all / active | HSB all / active | BFC all / active | Home Cell all / active |
|---|---|---|---|---|---|
| demo-test | 9 | 12 / 6 | 10 / 6 | 10 / 7 | 11 / 7 |
| wci-cardiff | 87 | 86 / 77 | 82 / 72 | 69 / 66 | 64 / 64 |

The RPC is the source of truth, and it does `COUNT(*) FILTER (WHERE water_baptism IS TRUE)` with no `membership_status` filter.

## Fix

Update the `get_dashboard_stats` SQL function so each growth milestone counter only includes members with `membership_status = 'Active'`. This makes the numerator and denominator (active member count) consistent and removes the >100% capping artifact.

`total`, `first_timers`, and `new_this_month` stay unchanged — they are intentionally tenant-wide.

### Technical detail

Migration to `CREATE OR REPLACE` `public.get_dashboard_stats(_tenant_id uuid)` with the four milestone counters changed to:

```sql
COUNT(*) FILTER (WHERE water_baptism IS TRUE AND membership_status = 'Active')
COUNT(*) FILTER (WHERE holy_spirit_baptism IS TRUE AND membership_status = 'Active')
COUNT(*) FILTER (WHERE bfc_completed IS TRUE AND membership_status = 'Active')
COUNT(*) FILTER (WHERE winners_satellite IS TRUE AND membership_status = 'Active')
```

No frontend changes needed — `Dashboard.jsx` already divides by `activeCount` and the `Math.min(100, …)` cap can stay as a safety net.

## Validation

After the migration, demo-test should show approximately: WB 6/9 (67%), HSB 6/9 (67%), BFC 7/9 (78%), Home Cell 7/9 (78%).
