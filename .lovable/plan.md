## Goal
When a Transport unit leader uses "Notify Passengers" from the Plan Driver Route dialog, the passenger's notification (email, SMS, in‑app) should clearly state **where** the driver will pick them up — pickup address plus the optional pickup location description — not just the time and stop number.

## Changes
**`supabase/functions/notify-transport-booking/index.ts`**
- In the `passengerHeadings["Pickup Scheduled"]` preset, change `bodyLine` to include the pickup address and description, e.g.:
  > "Your driver will pick you up at **{pickup_time}** from **{pickup_address}**{description ? ' — {description}' : ''}{stopNumber ? ' (Stop #{n} on the route)' : ''}. Please be ready a few minutes early."
- Since `bodyLine` is currently a static string built once at the top of the request, move the "Pickup Scheduled" preset to be computed after `pickup`, `pickupLocationDescription`, `pickup_time`, and `stopNumber` are known (already are by line 113), so the address/description interpolate correctly.
- The email detail block and SMS body already include pickup address + description, so no change needed there — only the headline `bodyLine` (which drives the in‑app notification message and the email/SMS lead sentence for "Pickup Scheduled").
- Redeploy the function.

## Out of scope
- No UI/route planner changes.
- No DB/schema changes.
- No changes to other status presets.