## Goal
Add a richer passenger check-in workflow to transport bookings with new statuses (Notified, Checked In, Picked Up, No-Show) and quick ways for the transport team to contact the member who requested the booking.

## Status lifecycle
Extend the existing `transport_status` enum from `Pending → Confirmed → In Transit → Completed / Cancelled` to:

```text
Pending → Confirmed → Notified → Checked In → Picked Up → Completed
                                                    ↘ No-Show (terminal)
                                       ↘ Cancelled (any time)
```

- **Notified**: driver has informed the passenger they're on the way / scheduled.
- **Checked In**: passenger confirmed they're ready at the pickup point.
- **Picked Up**: driver has collected the passenger.
- **No-Show**: passenger didn't appear at pickup.

Old "In Transit" is retained as a synonym path (still in DB enum for back-compat); the new "Picked Up" is the preferred forward state. Completed remains the final success state.

## Database changes
1. Add enum values to `transport_status`: `Notified`, `Checked In`, `Picked Up`, `No-Show` (idempotent `ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
2. Add columns to `public.transportation`:
   - `notified_at timestamptz`
   - `checked_in_at timestamptz`
   - `picked_up_at timestamptz`
   - `no_show_at timestamptz`
   - `checkin_notes text`
3. Extend `audit_transport_change()` to record transitions through the new statuses (status change already covered, but stamp the matching `*_at` via a small `BEFORE UPDATE` trigger that sets the timestamp when status flips to the corresponding value).

No RLS changes needed — existing policies cover updates by admins / Transportation unit leaders / members.

## Backend (Edge functions)
- `notify-transport-booking`: add a new `notification_type: "passenger_status"` path that sends the passenger (the requesting member) an email + optional SMS when their booking is set to **Notified** (e.g. "Your ride is on the way") or **Checked In** confirmation. Reuses existing email enqueue + Twilio quota path.
- No new function — extend the existing one.

## Frontend changes

### Status colours & order (`src/pages/Transportation.jsx`)
Update `statusColors` and `ALL_STATUSES` to include the new statuses with distinct theme colours.

### Detail panel (`src/components/transportation/TransportDetailPanel.jsx`)
Replace the single `nextStatus` map with a richer **Check-In Workflow** section visible to the transport team:
- Stepper showing the passenger journey with timestamps (Confirmed → Notified → Checked In → Picked Up → Completed).
- Action buttons that advance to the next step (`Notify Passenger`, `Mark Checked In`, `Mark Picked Up`, `Mark Completed`).
- Secondary action `Mark No-Show` (with confirm) available from Notified/Checked In states.
- `Cancel` action retained.
- Free-text **Check-in note** textarea saved to `checkin_notes`.

### Contact member actions
New **Contact Passenger** block in the detail panel with quick buttons:
- **Call** → `tel:` link to `members.phone`
- **SMS** → `sms:` link with a prefilled message ("Hi {name}, this is {church} transport. We're on our way for your {pickup_time} pickup.")
- **WhatsApp** → `https://wa.me/<E164>` deep link
- **Email** → `mailto:` link to `members.email`
- **Send notification**: triggers the new `notify-transport-booking` `passenger_status` path so it goes through the church's email/SMS gateway and is logged.

Phone numbers are normalised via existing `src/lib/phone-utils.js` `normalizePhone` before building the deep links.

### Booking form (`TransportBookingDialog.jsx`)
Add the new statuses to the manager-side status `Select`. No other changes.

## Out of scope
- No changes to financial tracking, no new tables.
- No changes to member-facing self-service beyond seeing the new status badge on their own booking.

## Files to touch
- `supabase/migrations/<new>.sql` (enum + columns + trigger)
- `supabase/functions/notify-transport-booking/index.ts` (passenger_status branch)
- `src/pages/Transportation.jsx` (statuses, colours, filters, manage dialog options)
- `src/components/transportation/TransportDetailPanel.jsx` (check-in stepper, contact block, no-show)
- `src/components/transportation/TransportBookingDialog.jsx` (status options)
