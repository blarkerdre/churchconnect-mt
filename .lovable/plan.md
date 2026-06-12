## Goal
Four related Transportation improvements:
1. Drivers and Assignees see only the bookings assigned to them (both the main Transportation list and Plan Driver Route).
2. Plan Driver Route accepts a date range (From / To) instead of a single date.
3. Booking request requires the passenger's **postcode**; on submit, the system finds the nearest active pickup point and tells the passenger which one will be used.
4. Drivers can see when each passenger has acknowledged their pickup.

## 1) Scope visibility to "own bookings only" for Driver & Assignee

**`src/pages/Transportation.jsx`** — `visibleBookings` (lines 135‑139)
- Today, anyone in `isTransportUnit` sees every booking. Tighten the rule:
  - Admins / unit leaders (`isLeader`) → still see all.
  - Transport unit members who are NOT leaders → see only bookings where they are passenger, assignee, or driver (same as the non‑unit branch).
- The booking list, stats cards, filters, search, CSV export, and Route Planner all derive from this list, so they will automatically scope down.

**`src/components/transportation/RoutePlannerDialog.jsx`**
- `driverOptions` currently lists every transport unit member. For non‑leaders, restrict it to the current user only and preselect their `user_id`.
- `candidates` already filters by `driver_user_id`/`assigned_to`, so no additional change there.

RLS already permits this view (existing `View transport bookings` policy covers driver/assignee), so no DB changes are required.

## 2) Date range in Plan Driver Route

**`RoutePlannerDialog.jsx`**
- Replace the single `date` state with `dateFrom` / `dateTo` (default both = today). Render two date inputs side‑by‑side.
- Update `candidates` filter to `b.request_date >= dateFrom && b.request_date <= dateTo`.
- Sort order: by `request_date` first, then `pickup_order` (NULLS LAST), then `pickup_time`.
- Show each stop's date next to "Stop N" so a multi‑day route is readable.
- `handleSave` and `handleClear` are unchanged (they operate per row).
- `handleNotify` is unchanged; each booking's own `request_date` is already sent.

## 3) Passenger postcode + nearest pickup point

### Schema (new migration)
- `transportation`: add `pickup_postcode text` and `nearest_pickup_location_id uuid references pickup_locations(id)`.
- `pickup_locations`: add `postcode text`, `latitude double precision`, `longitude double precision`. Keep existing rows valid (nullable).

No new tables, no policy changes (existing policies cover the columns).

### Geocoding
- Use **postcodes.io** (free UK service, no API key, no secret to manage). All requests are server‑side from an edge function so the client never makes cross‑origin calls.

### New edge function: `resolve-nearest-pickup`
- Input: `{ tenant_id, postcode }`.
- Steps:
  1. Validate postcode (Zod, UK format `^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$`, case‑insensitive).
  2. `GET https://api.postcodes.io/postcodes/{postcode}` → lat/lng.
  3. Service‑role select active `pickup_locations` for that tenant.
  4. For locations missing lat/lng but having a postcode, geocode and persist (one‑time backfill per row).
  5. Haversine distance; return the closest `{ id, name, address, distance_km }`. If none have coordinates, return `null` so the UI can fall back gracefully.
- `verify_jwt = false` (default for Lovable Cloud); validate the caller's session inside the function using the incoming `Authorization` header before doing tenant lookups.

### Booking dialog UI — `src/pages/Transportation.jsx`
- Add a required `pickup_postcode` input to the booking form (with help text "We'll match you to the nearest pickup point").
- On submit, before `INSERT`:
  - Call `resolve-nearest-pickup`.
  - If a match is returned, set `nearest_pickup_location_id`, prefill `pickup_address` with the matched location's address (if the user left it blank), and append a line to `pickup_location_description`: `"Nearest pickup: {name} — {address}"`.
  - Show a toast: *"Your pickup point will be {name} ({distance} km away)."*
  - If the postcode is invalid or no match is found, save the booking with the postcode only and toast the passenger to coordinate with the transport team — do NOT block submission.
- In the detail panel, render the resolved pickup location name + address alongside the postcode.

### Pickup Locations admin UI
- Add `Postcode` field (optional, recommended) to the pickup location form. Latitude/longitude are populated automatically by the edge function the first time the location is used.

## 4) Driver sees passenger acknowledgement

The schema already has `passenger_acknowledged_at` and an RLS policy letting the passenger update it. Two UI additions:

**Passenger side — `MyProfile` / Transportation list**
- For `canAcknowledge(b)` rows (already exists), keep the existing button.

**Driver side — `RoutePlannerDialog.jsx`**
- For each stop, show an "Acknowledged" badge (green check + time) when `passenger_acknowledged_at` is set, or a muted "Awaiting acknowledgement" pill otherwise.

**Transportation list (`src/pages/Transportation.jsx`)**
- In the row meta (where assignee/driver chips live), surface the same Acknowledged/Awaiting indicator when the current user is the driver or assignee, so a driver scanning their list sees ack status at a glance.

No new edge function or DB change needed for #4.

## Technical summary
- Files changed: `src/pages/Transportation.jsx`, `src/components/transportation/RoutePlannerDialog.jsx`.
- New file: `supabase/functions/resolve-nearest-pickup/index.ts`.
- Migration: add 2 columns to `transportation`, 3 columns to `pickup_locations`.
- External call: postcodes.io (no key, no new secret).
- No changes to notification edge function logic in this round; existing `pickup_location_description` is already included in passenger notifications.

## Out of scope
- Multi‑country geocoding (postcodes.io is UK only — acceptable for WCI Cardiff).
- Auto‑re‑routing when a passenger's postcode changes after booking.
- Bulk geocoding of all existing pickup_locations up‑front (done lazily on first use).
