## Goal
1. Drivers receive a notification with their full pickup list (in stop order) when the leader publishes a route.
2. Drivers can view that ordered passenger list in the app.
3. Only **unit leaders** (Transportation leaders / admins) can open Plan Driver Route in edit mode — drivers see it as read-only.

## Changes

### `src/components/transportation/RoutePlannerDialog.jsx`
- **Edit lock**: when `!isLeader`, render the dialog in read-only mode:
  - Hide drag handles, arrow buttons, time inputs, Save/Clear/Notify buttons.
  - Show a banner: "Route set by your Transportation leader."
  - Keep the date range + stops list visible so drivers can review their schedule.
- **Notify Driver button** (leaders only): new secondary button next to "Notify Passengers". Sends a single in-app notification to the selected driver containing the ordered stop list (passenger name, pickup time, address, postcode, phone, pax count) for the date range. Implementation: call `notify-transport-booking` once with a new `notification_type: "driver_route"` payload containing the stops array, or insert directly into `notifications` table for the driver.

### `supabase/functions/notify-transport-booking/index.ts`
- Add a `driver_route` branch that accepts `{ driver_user_id, tenant_id, date_from, date_to, stops: [...] }` and:
  - Creates one in-app `notifications` row for the driver with a formatted body listing stops in order.
  - (Email/SMS optional — in-app only per prior decision.)

### `src/pages/Transportation.jsx` — driver view
- For drivers (non-leaders), the existing list already filters to their own assignments. Add sort-by-`pickup_order` (then `pickup_time`) for the driver's view so the order matches the planned route, and surface a "Stop N" badge (already rendered when `pickup_order != null`).
- Add a "View My Route" button in the page header for users who have any booking with `driver_user_id === user.id`, opening `RoutePlannerDialog` in read-only mode prefilled to themselves.

### Out of scope
- No DB schema changes (uses existing `notifications` table and `pickup_order`/`pickup_time` columns).
- No change to passenger notify flow or acknowledgement gating.

## Files touched
- `src/components/transportation/RoutePlannerDialog.jsx`
- `src/pages/Transportation.jsx`
- `supabase/functions/notify-transport-booking/index.ts`
