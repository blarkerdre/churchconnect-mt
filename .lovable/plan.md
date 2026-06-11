## Goal
1. Include the assigned driver's name and phone in passenger notifications (in‑app, email, SMS) for the "Pickup Scheduled" message sent from Plan Driver Route.
2. Shorten the passenger SMS so a typical "Pickup Scheduled" message fits within a single SMS segment (160 GSM-7 chars), with safe truncation when fields are long.

## Changes

**`src/components/transportation/RoutePlannerDialog.jsx` — `handleNotify`**
- Look up the selected driver's phone from `transportMembers` (using `driverId`) and pass `driver_name` + `driver_phone` in the `notify-transport-booking` invoke body (currently only `driver_name` is passed).

**`supabase/functions/notify-transport-booking/index.ts`**
- Driver line is already rendered in the email detail block when `body.driver_name` is present — no change.
- In-app notification: extend the `passengerHeadings["Pickup Scheduled"]` `bodyLine` so it mentions the driver, e.g. append ` Driver: {driver_name} ({driver_phone}).` when provided.
- SMS body for `passengerMode`: rewrite to a compact single-segment template. New format (no emojis, ASCII only to stay GSM-7):
  ```
  {ChurchShort}: Pickup {date} {time} from {pickup}. {desc?}Driver {name} {phone}. Stop #{n}.
  ```
  Apply per-field caps so total ≤ 160 chars:
  - church short name capped at 16
  - pickup address capped at 40 (ellipsis if longer)
  - pickup_location_description capped at 30 (omitted if it would push past 160)
  - driver name capped at 20
  - After building, if still > 160, drop fields in this order: description, stop number, driver phone, driver name — until it fits, then hard‑truncate with `…` as final safety net.
- Keep current verbose SMS for non-passenger modes (leader/assignee) unchanged.

## Out of scope
- No DB/schema changes.
- No UI changes outside `RoutePlannerDialog`.
- No changes to email layout (already shows driver row).