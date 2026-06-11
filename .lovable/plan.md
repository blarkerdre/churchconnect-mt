Add a `pickup_location_description` text field to transport bookings so passengers can describe exactly where they will be picked up (e.g., "Blue house with red door", "Opposite Tesco"). Include this description in all passenger-facing notifications (email, SMS, in-app).

Technical Details
- Database migration: add `pickup_location_description TEXT` to the `transportation` table.
- `src/integrations/supabase/types.ts`: add `pickup_location_description?: string | null` to the `transportation` row/insert/update types.
- `src/components/transportation/TransportBookingDialog.jsx`: add a "Pickup Location Description" textarea below the "Pickup Address" field with placeholder "e.g., Blue house with red door, opposite Tesco". Include it in the form state and submission.
- `src/components/transportation/TransportDetailPanel.jsx`: display the pickup location description in the detail panel if present.
- `src/components/transportation/RoutePlannerDialog.jsx`: display the pickup location description under each stop's address in the route planner list.
- `src/pages/Transportation.jsx`: include `pickup_location_description` in the booking mutation payloads, the CSV export, and pass it through to all notification invokes.
- `supabase/functions/notify-transport-booking/index.ts`: add `pickup_location_description` to the request body destructuring. Include it in the email HTML detail block (label: "Location Description:") and in the SMS body when present.

Files to edit: `supabase/migrations/...` (new), `src/integrations/supabase/types.ts`, `TransportBookingDialog.jsx`, `TransportDetailPanel.jsx`, `RoutePlannerDialog.jsx`, `Transportation.jsx`, `notify-transport-booking/index.ts`.
