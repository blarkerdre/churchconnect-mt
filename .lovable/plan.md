## Goal
Drivers (Transportation + Kingdom Chariot members) using the **Plan Driver Route** dialog ("My Route") should be able to filter their assigned stops by date range and print the resulting route sheet. Currently only leaders see Save/Notify/Clear actions, and there is no print option at all.

## File
`src/components/transportation/RoutePlannerDialog.jsx`

## Changes (UI only, no backend/schema)

1. **Keep existing date-range + driver filters.** Non-leaders are already locked to themselves and to the from/to range — that satisfies "filter".

2. **Add a "Print My Route" button** visible to everyone whenever `order.length > 0` (leaders keep their existing action row; non-leaders get a single Print button at the bottom of the stop list).

3. **Print output** uses `window.open` + inline HTML (same pattern as `PrintReportButton`), titled:
   - Non-leader: `My Route — {driverName} — {dateFrom} to {dateTo}` (or single date when `dateFrom === dateTo`).
   - Leader: `Driver Route — {driverName} — {dateFrom} to {dateTo}`.
   Header meta line: generated timestamp + total stop count + total passenger count.
   Columns: `Stop #`, `Date` (only when `multiDay`), `Pickup Time`, `Passenger`, `Phone`, `Passengers`, `Pickup Address`, `Postcode`, `Pickup Notes`, `Destination`, `Status`.
   Rows come from current `order` array (already filtered, sorted by stop number).
   Reuse the same `escHtml` helper inline.

4. **Optional CSV** — out of scope for this request (user asked specifically for print). Skip.

5. **No permission/RLS changes** — drivers already only see their own bookings via `visibleBookings` upstream in `Transportation.jsx`, and the dialog auto-locks the driver selector for non-leaders.

## Files touched
- `src/components/transportation/RoutePlannerDialog.jsx`
