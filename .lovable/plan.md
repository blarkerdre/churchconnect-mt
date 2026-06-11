## Goal
Let Transport unit leaders set a pickup order per driver, so each driver sees their assigned bookings in the sequence to pick passengers.

## Database
Add `pickup_order INTEGER` column to `public.transportation` (nullable, default null). Index on `(tenant_id, driver_user_id, request_date, pickup_order)` to support sorted reads.

## UI — Transportation page (`src/pages/Transportation.jsx`)
1. **New "Route Planner" dialog** (leader-only), opened from a new "Plan Route" button next to "Report".
   - Filters: Date (default today/next service date) + Driver dropdown (populated from bookings' `driver_user_id` / `assigned_driver`).
   - Shows all bookings for the chosen driver+date as a drag-and-drop ordered list (using existing drag pattern; HTML5 native DnD — no new dep). Each row shows passenger name, pickup address, pickup time, phone.
   - "Save Order" persists `pickup_order` (1..N) for those rows via a single update batch, scoped by `tenant_id`.
   - "Notify Driver" optional button: invokes existing `notify-transport-booking` (passenger_status not needed) — out of scope for v1; just save order.

2. **Booking list ordering**: when `filterAssignee` is set to a specific driver AND a single date is selected, sort by `pickup_order NULLS LAST, pickup_time`. Otherwise keep current `request_date desc` ordering.

3. **Detail panel + driver view**: show "Stop #N" badge when `pickup_order` is set, so drivers (and assignees) see their sequence at a glance.

4. **CSV export**: add `Stop #` column.

## Access control
- Only `isLeader` (admin or Transportation unit leader) sees the "Plan Route" button and can save order. Drivers/passengers see the stop number read-only.

## Out of scope
- No route optimization, mapping, or ETA calc.
- No changes to notification edge functions.

## Technical notes
- Drag-and-drop: native HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — keeps bundle lean, no new packages.
- Batch save: `Promise.all` of `.update({ pickup_order: idx+1 }).eq("id", id).eq("tenant_id", tenantId)`.
- Invalidate `["transportation", tenantId]` after save.

## Files
- New: `src/components/transportation/RoutePlannerDialog.jsx`
- Edit: `src/pages/Transportation.jsx` (button, sort, stop badge, CSV column)
- Migration: add `pickup_order` column + index.
