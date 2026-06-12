# Kingdom Chariot drivers + availability flow

## 1. Driver pool expansion
Currently only members whose `church_unit` matches `%Transport%` appear as drivers. Add Kingdom Chariot alongside.

- In `src/pages/Transportation.jsx`, extend the `transport-unit-members` query to fetch members where `church_unit` matches `%Transport%` OR `%Kingdom Chariot%`, and tag each member with `unit_label` ("Transportation" or "Kingdom Chariot").
- Reuse the same query/map for the assignment dropdown and driver pickers throughout Transportation + `RoutePlannerDialog`.

## 2. Differentiation in UI
- **Driver dropdown** (Manage Booking + Route Planner): render as two grouped sections — `Kingdom Chariot` then `Transportation`, each as a labelled group header.
- **Badges**: next to the driver/assignee name in the bookings list, detail panel, and route planner stops, show a small badge — gold "Kingdom Chariot" or navy "Transportation".
- Add a tiny `DriverUnitBadge` helper component in `src/components/transportation/`.

## 3. Leader role bridging
Kingdom Chariot leader should have the same booking-management powers as the Transportation leader.

- In `Transportation.jsx`, update `isLeader` to:
  `isAdmin || leaderUnits.includes("Transportation") || leaderUnits.includes("Kingdom Chariot")`.
- Apply the same change anywhere `leaderUnits.includes("Transportation")` is checked in the transport module.

## 4. Driver availability submission (new)

### New table: `driver_availability`
Columns: `id`, `tenant_id`, `driver_user_id`, `driver_member_id`, `driver_unit` (text — "Kingdom Chariot" / "Transportation"), `available_date` (date), `service_type` (text), `pickup_area_address` (text), `pickup_area_postcode` (text, optional), `seats_available` (int), `notes` (text, optional), `status` (text default `open` — open/matched/cancelled), `created_at`, `updated_at`.

RLS: drivers manage their own rows; Transportation + Kingdom Chariot leaders and admins can read/update all rows within their tenant.

### New dialog: `DriverAvailabilityDialog`
A member of either driver unit sees a **"Mark Availability"** button on the Transportation page. Dialog fields:
- Date (date picker)
- Service to attend — `<Select>` from `useAppSetting("service_types", DEFAULT_SERVICE_TYPES)` (same source the booking form uses)
- Address (pre-fill from member.address; editable)
- Postcode (optional)
- Seats available (number, min 1)
- Notes (optional)

On submit:
1. Insert into `driver_availability`.
2. Invoke `notify-transport-booking` with a new `notification_type: "driver_availability"` payload — recipients = current Transportation + Kingdom Chariot unit leaders (looked up server-side via `unit_leader_assignments`). In-app notification + email; no SMS (consistent with `driver_route`).

### Leader view: `Driver Availability` tab/panel
On `Transportation.jsx`, add a leader-only **"Availability"** section (collapsible card above the bookings list, or a tab) that lists open availability entries grouped by date with: driver name + unit badge, service, address/postcode, seats, notes. Each row has:
- **Use for booking** — quick-assign action that opens a booking-picker filtered to that date/service with no driver assigned, and on selection sets `driver_user_id`, `assigned_driver`, `driver_phone`, and marks the availability `matched`.
- **Dismiss** — sets status to `cancelled`.

Drivers themselves see only their own future entries with a cancel button.

## 5. Edge function update
`supabase/functions/notify-transport-booking/index.ts` — add a `driver_availability` short-circuit branch (alongside `driver_route`):
- Input: `tenant_id`, `availability_id`, `driver_name`, `driver_unit`, `available_date`, `service_type`, `pickup_area`, `seats`, `notes`, `leader_user_ids[]`.
- Insert one in-app notification per leader, send email via existing enqueue path. No SMS.

## Files

- `supabase/migrations/<new>.sql` — `driver_availability` table + grants + RLS + updated_at trigger.
- `src/pages/Transportation.jsx` — extended driver query, isLeader update, Mark-Availability button, Availability section.
- `src/components/transportation/DriverAvailabilityDialog.jsx` — new.
- `src/components/transportation/DriverUnitBadge.jsx` — new small helper.
- `src/components/transportation/RoutePlannerDialog.jsx` — grouped driver dropdown + badges on stop rows.
- `supabase/functions/notify-transport-booking/index.ts` — add `driver_availability` branch.

## Out of scope
- No auto-matching algorithm (only manual "Use for booking").
- No SMS for availability notifications.
- No changes to passenger booking flow or acknowledgement gating.
- "Kingdom Chariot" is hardcoded as the second driver unit name (matched case-insensitively); not configurable in Settings.
