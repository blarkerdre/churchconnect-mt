## Add Single / Round Trip option to Transport Bookings

Let members specify whether a booking is a one-way (single) trip or a round trip, and surface that throughout the UI and notifications.

### Changes

1. **Database (migration)**
   - Add `journey_type` text column to `transportation` (values: `Single`, `Round Trip`, default `Single`).
   - For round trips, add `return_date` (date) and `return_time` (time) nullable columns so passengers can specify the return pickup.

2. **Booking form** (`src/components/transportation/TransportBookingDialog.jsx`)
   - Add a "Journey Type" radio/select with **Single Trip** and **Round Trip**.
   - When **Round Trip** is selected, reveal **Return Date** and **Return Pickup Time** fields (required in that mode).
   - Persist `journey_type`, `return_date`, `return_time` on save.

3. **Booking detail panel** (`src/components/transportation/TransportDetailPanel.jsx`)
   - Show Journey Type badge.
   - If round trip, display Return Date & Time row.

4. **Transportation list/cards** (`src/pages/Transportation.jsx`)
   - Show a small "Round Trip" / "Single" tag on each booking row.
   - Include journey info in the detail dialog already used for the passenger view.

5. **Notifications** (`supabase/functions/notify-transport-booking/index.ts` + the two trigger functions)
   - Include `journey_type` and `return_date` / `return_time` in the payload sent to passengers, leaders, and assigned drivers so messages mention return leg when applicable.

### Out of scope
No changes to assignment logic, status workflow, or reports — just capturing and surfacing the trip type.
