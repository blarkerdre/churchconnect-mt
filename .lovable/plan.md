## Goal
Let Transport unit leaders set/adjust the pickup time per passenger booking (alongside route ordering) and notify the passenger of their confirmed pickup time via email/SMS/in-app.

## Changes

### 1. Route Planner Dialog (`src/components/transportation/RoutePlannerDialog.jsx`)
- Add an editable **Pickup Time** input next to each booking row in the drag-and-drop list.
- "Save Pickup Order" persists both `pickup_order` and the (possibly updated) `pickup_time` per row in the same batched update.
- Add a **"Notify Passengers"** button (leader-only) that, for each ordered booking with a `pickup_time`, invokes the existing `notify-transport-booking` edge function with `notification_type: "passenger_status"` and a new status `"Pickup Scheduled"` so the passenger receives email + SMS + in-app notification with their assigned pickup time.
- Show per-row send state (sent / skipped if no time).

### 2. Edge function (`supabase/functions/notify-transport-booking/index.ts`)
- Extend the `passengerHeadings` preset map with a new `"Pickup Scheduled"` entry:
  - subject: "Your pickup time is scheduled"
  - heading: "Your Pickup Time"
  - body line includes the assigned pickup time and stop number when present.
- Accept optional `stop_number` in the body and include it in email detail block + SMS body when provided.
- No auth/CORS changes.

### 3. Transportation page (`src/pages/Transportation.jsx`)
- No business-logic change; route-sorted list already shows Stop # and pickup_time. Detail panel already reflects pickup_time updates.

## Out of scope
- No new DB columns (uses existing `pickup_time` and `pickup_order`).
- No driver-facing notification (already covered by assignment flow).
- No ETA calculation or maps.

## Files touched
- `src/components/transportation/RoutePlannerDialog.jsx` (edit time inline, notify button, invoke edge fn)
- `supabase/functions/notify-transport-booking/index.ts` (new "Pickup Scheduled" preset + stop number)
