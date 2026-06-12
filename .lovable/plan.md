## Filter Kingdom Chariot drivers by availability

Currently, both the **Route Planner** and **Manage Booking** driver dropdowns list every member of the Kingdom Chariot unit as a selectable driver. The user wants Kingdom Chariot members to appear only when they have explicitly marked themselves as available to pick passengers.

### Changes

#### 1. Route Planner dialog (`src/components/transportation/RoutePlannerDialog.jsx`)
- Accept a new prop: `availabilityEntries` (from the existing `driver_availability` query in `Transportation.jsx`).
- When building the `driverOptions` list, keep **Transportation** members unchanged (always shown).
- For **Kingdom Chariot** members, only include them if at least one `availabilityEntries` row exists for that driver with `available_date` inside the currently selected `dateFrom` → `dateTo` range.
- If the date range changes and a previously selected Kingdom Chariot driver no longer has availability, gracefully clear the selection and show the "Select driver" placeholder.

#### 2. Manage Booking dialog (`src/pages/Transportation.jsx`)
- The dialog already knows the selected booking via `selectedBooking.request_date`.
- In the **Driver (Kingdom Chariot / Transport)** dropdown, filter the Kingdom Chariot group so only members with an `availabilityEntries` row for `available_date === selectedBooking.request_date` are listed.
- Transportation members remain always visible.

### Out of scope
- No database or schema changes.
- No changes to the Transportation unit logic (they remain always visible).
- No changes to the auto-matching edge function.

### Files edited
- `src/pages/Transportation.jsx` — pass `availabilityEntries` to `RoutePlannerDialog`; filter Kingdom Chariot drivers in Manage Booking dialog.
- `src/components/transportation/RoutePlannerDialog.jsx` — filter Kingdom Chariot drivers by date-range availability when building `driverOptions`.