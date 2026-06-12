## Goal
Match Kingdom Chariot passengers to drivers automatically based on **driver availability postcode** (with nearest-driver fallback when no postcode match), while still allowing leaders to freely reassign.

## How matching works
For each unassigned booking on a given date:
1. Load all `driver_availability` rows for that date (+ service_type when set on booking).
2. **Postcode-prefix match first** — compare booking `pickup_postcode` outward code (e.g. `CF10`) to each availability's `pickup_area_postcode` outward code. Best match wins; ties broken by remaining `seats_available` (desc).
3. **Geo fallback** — if no postcode match (or booking has no postcode), call existing `resolve-nearest-pickup` style logic via a new small edge function `match-driver-by-postcode` that geocodes both postcodes via postcodes.io and picks the driver with the smallest haversine distance.
4. Skip drivers whose remaining seats (`seats_available − already-assigned passengers that day`) is less than booking `passengers`.
5. Write `driver_member_id`, `driver_name`, `vehicle`, `status='Confirmed'`, `assigned_at`, `auto_matched=true` onto `transportation` row (scoped by `tenant_id`). Log via `logAudit`.

## Triggers
1. **On booking creation** (`bookMutation` in `src/pages/Transportation.jsx`)
   - After insert + nearest-pickup resolution, invoke `match-driver-by-postcode` with the new booking id.
   - If a driver is found, update the row and toast "Auto-matched to {driverName}".
   - Silent no-op when no match — leader handles manually.
2. **Bulk button in Route Planner** (`src/components/transportation/RoutePlannerDialog.jsx`)
   - Visible only to leaders. New "Auto-match unassigned" button next to the date filter.
   - Runs matching for every booking in `visibleBookings` for the selected date range where `driver_member_id` is null.
   - Shows toast summary: "Matched X of Y passengers".

## Override
Leader assignments via existing UI (driver selector, drag-reorder, manual edits) overwrite auto-match without restriction. `auto_matched` flag flips to `false` whenever the leader changes the driver, so reporting can distinguish.

## Files

### New
- `supabase/migrations/<ts>_transport_auto_match.sql`
  - `ALTER TABLE public.transportation ADD COLUMN auto_matched boolean DEFAULT false`
  - `ALTER TABLE public.transportation ADD COLUMN assigned_at timestamptz`
- `supabase/functions/match-driver-by-postcode/index.ts`
  - Accepts `{ tenant_id, booking_id }` OR `{ tenant_id, booking_ids: [] }`.
  - Validates caller JWT + tenant membership.
  - Runs postcode-prefix → geo fallback algorithm; returns `{ matches: [{ booking_id, driver_member_id, driver_name, vehicle, reason }] }` and updates rows server-side using service role.

### Edited
- `src/pages/Transportation.jsx`
  - After successful `bookMutation` insert, invoke new function for the new booking id; show toast.
- `src/components/transportation/RoutePlannerDialog.jsx`
  - Add "Auto-match unassigned" leader button; calls function with current unassigned booking ids for the date range; refreshes `order` after.

## Out of scope
- No changes to `driver_availability` schema.
- No changes to nearest-pickup logic.
- No automated reassignment when leader changes anything — purely additive.
