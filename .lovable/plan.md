## Goal
Four small Transportation changes:
1. Remove **Pickup Location Description** and **Pickup Time** fields from the passenger booking form.
2. Add a **Service to attend** dropdown sourced from the tenant's `service_types` app setting (Settings → Services).
3. In the **Manage Booking** dialog (admin/leader), rename the *Pickup Location Description* field label to **Pickup Location**.
4. Passengers can only see/use the **Acknowledge** button after the booking has been notified (i.e. `notified_at` is set).

## Changes

### Database (migration)
- `transportation`: add `service_type text` (nullable). No new policies — existing ones cover it.

### `src/pages/Transportation.jsx` (passenger booking form, lines ~71, 182‑191, 453, ~800‑825)
- Remove `pickup_location_description` and `pickup_time` from the passenger form state, payload, reset handler, and the two input fields in the dialog.
- Add `service_type` to the form state and payload.
- Insert a **Service to attend** `<Select>` populated via `useAppSetting("service_types", DEFAULT_SERVICE_TYPES)` (same hook/key used by Settings → Services). Required field.
- Keep the existing `notes` field as-is.
- Keep return-leg `return_time` (this is a different field from `pickup_time` and the spec only calls out pickup time on the booking form — confirm with caller if they want this removed too; assumption: leave it).

### `src/pages/Transportation.jsx` (Manage Booking dialog, lines ~903‑907)
- Change the `<Label>` text from "Pickup Location Description" to **"Pickup Location"**. Field, state, and persistence stay the same.

### `src/pages/Transportation.jsx` (Acknowledge gating, around lines 545‑560 and 715‑725)
- Update `canAcknowledge(b)` so it returns true **only if** `b.notified_at` is set (in addition to existing checks: passenger is current user and not already acknowledged).
- Same gate applies to both the list row and the detail panel button.

### Detail / list rendering
- Surface `service_type` in the booking detail panel and on list rows where trip context is shown (small chip next to date/time).
- Where `pickup_time` is no longer collected from passengers, the existing list/detail still render it when present (set by Route Planner) — no change needed.

### Out of scope
- Migrating the old `trip_type` field from `TransportBookingDialog.jsx` (legacy/unused in the current flow).
- Removing `pickup_time` from the schema (drivers still populate it via Route Planner).
- Changes to notification edge function (no payload change required; `service_type` can be added later if desired).

## Files touched
- `src/pages/Transportation.jsx`
- Migration adding `transportation.service_type`
