# Passenger notifications for transport bookings

Today the passenger only gets an email/SMS when an admin clicks **Notify Passenger**, and never gets an in‑app (bell) notification. We'll fix both.

## Changes

### 1. `supabase/functions/notify-transport-booking/index.ts`
For every recipient (passenger, assigned driver, leaders), after sending email/SMS, also insert a row into `notifications` so the in‑app bell + push notification fire:

- `user_id` = recipient's user_id
- `tenant_id` = booking tenant
- `type` = `"transport"`
- `reference_type` = `"transport"`, `reference_id` = `booking_id`
- `title` / `message` derived from the same `passengerHeadings` preset for passenger flows, or "New transport booking" / "Transport booking assigned" for leaders/drivers
- Skip insert if `user_id` is null (e.g. passenger has no linked account)

The existing `send-push` route map already includes `transport → /transportation`, so push delivery is automatic via the existing notifications trigger.

### 2. `src/pages/Transportation.jsx` — `statusMutation`
After a successful status update, automatically invoke `notify-transport-booking` with `notification_type: "passenger_status"` when the new status is one the passenger should hear about: `Confirmed`, `Notified`, `Checked In`, `Picked Up`, `Completed`, `No-Show`, `Cancelled`. (Today this only happens when the admin clicks the separate **Notify Passenger** button.)

Add `"No-Show"` and `"Cancelled"` entries to `passengerHeadings` in the edge function so those statuses produce appropriate subject/body lines instead of the generic fallback.

## Out of scope
- No DB migration (uses existing `notifications` table).
- No template/UI changes beyond the auto‑trigger.
- Leader/driver notification flow (`new_booking`, `assignment`) already works — only gains the in‑app row.

## Verification
1. Change a booking from Confirmed → Notified → Checked In. Confirm passenger receives:
   - Bell notification in app
   - Email row in `email_send_log`
   - SMS row in `sms_log` (if phone present and SMS enabled)
2. Assign a driver — confirm driver gets bell notification in addition to existing email/SMS.
