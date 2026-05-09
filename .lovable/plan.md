## Findings

### 1. Dashboard "Awaiting follow-up" metric is misleading
`src/pages/Dashboard.jsx` line 129:
```js
{ title: "First Timers", value: firstTimers, change: "Awaiting follow-up", ... }
```
The number shown is the count of **members with status = "First Timer"** (from `get_dashboard_stats` RPC), but the sub-label says "Awaiting follow-up". These aren't the same:
- A First Timer with no follow-up record → counted, but nothing is awaiting.
- A First Timer with all follow-ups completed → counted, but nothing is awaiting.
- An Active member with a Pending follow-up → not counted, but it IS awaiting.

So the tile under-reports/over-reports the real workload.

### 2. "Unknown" record on Follow-ups page
There is **1 follow-up row in `wci-cardiff` with `member_id = NULL`** that renders as `person_name: "Unknown"`:
- Type: Visitor
- Description: "New visitor registered: Godfrey  Banga. Welcome and invite them back."
- Status: Pending, no due date, created 2026-05-03

This was created by the public-registration flow as a Visitor welcome task but the linked member was never persisted (or was deleted), leaving an orphan.

The Followups page also shows "Unknown" for any follow-up whose `assigned_to` user can't be found in `profiles` — that's a separate fallback in `profileMap`.

## Plan

### A. Fix the Dashboard "Awaiting follow-up" tile
- Add a new query in `src/pages/Dashboard.jsx` that counts follow-ups for the current tenant where `status IN ('Pending', 'In Progress')`, scoped with `.eq("tenant_id", tenantId)`.
- Replace the misleading "First Timers / Awaiting follow-up" tile with:
  - **Title**: "Awaiting Follow-up"
  - **Value**: pending+in-progress follow-up count
  - **Sub-label**: `"<firstTimers> first timers · <overdue> overdue"` so the First Timer headline number is preserved as context.
  - Icon: keep `UserPlus` (or switch to `HeartHandshake` to match the Follow-ups page).
- Pull "overdue" from the same query (rows where `due_date < today` and not Completed).

### B. Remove the orphan "Unknown" follow-up
- Delete the single row `6ae86a8f-f86e-4bd8-9c92-0caab4749720` (member_id IS NULL, tenant = wci-cardiff) via a migration.
- Belt-and-braces: also delete any other rows in `followups` where `member_id IS NULL` for the same tenant in the same migration (currently only this one, but safer).

### C. Prevent future orphans
- In `src/pages/Followups.jsx` (line ~99 and the list render at ~344), filter out rows where `f.member_id` is null OR `f.members` is null in the displayed list, instead of rendering them as "Unknown". This is a UI safety net for any orphans that might appear in other tenants.
- Also tighten the public registration / visitor flow so it does not insert a follow-up without a `member_id`. (Will identify the exact insert site during build — likely `supabase/functions/public-register/index.ts` or a DB trigger; will not change behavior beyond requiring `member_id`.)

### D. Out of scope
- Not changing the `get_dashboard_stats` RPC.
- Not touching the `profileMap` "Unknown" fallback for `assigned_to` (that's a separate concept — unassigned/missing assignee).
- No schema changes beyond the data delete.

## Files touched
- `src/pages/Dashboard.jsx` — new query + revised tile
- `src/pages/Followups.jsx` — filter out null-member rows
- One migration — delete orphan follow-up(s) for wci-cardiff
- Possibly `supabase/functions/public-register/index.ts` (only if it's the source of the orphan; will read first and only edit if needed)

## Validation
- After deploy, Dashboard tile shows actual pending follow-up count (should be ~23 for wci-cardiff) with first-timer + overdue context.
- Follow-ups page no longer shows the "Unknown" Visitor row.
- DB query confirms zero null-member follow-ups remain.
