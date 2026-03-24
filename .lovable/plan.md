

## Add Date Filter, Print & Download to Pastoral Care and Transportation

### Part 1: Pastoral Care (`src/pages/PastoralCare.jsx`)

1. **Add state** for `dateFrom`, `dateTo`, and `filterStatus` (status filter dropdown)
2. **Add controls row** below search: two `<Input type="date">` for date range, a status filter `<Select>` (All/Open/In Progress/Resolved/Closed), plus Download CSV and Print buttons
3. **Update filtering logic** to include date range (using `created_at` date portion) and status filter alongside existing search
4. **Update summary cards** to use filtered counts instead of `visibleCases`
5. **Add CSV download** function exporting: Subject, Member, Type, Status, Confidential, Assigned To, Created Date, Resolution Notes
6. **Add Print** using existing `PrintReportButton` with same columns
7. **Import** `Download` from lucide-react and `PrintReportButton`

### Part 2: Transportation (`src/pages/Transportation.jsx`)

1. **Add state** for `search`, `dateFrom`, `dateTo`, and `filterStatus`
2. **Add controls row** before the bookings list: search input, two date inputs, status filter `<Select>` (All/Pending/Confirmed/Completed/Cancelled), Download CSV and Print buttons
3. **Filter `visibleBookings`** client-side by search (member name, pickup, destination), date range (`request_date`), and status
4. **Update summary cards** to use filtered counts
5. **Add CSV download** exporting: Member, Pickup, Destination, Date, Time, Passengers, Status, Driver, Driver Phone, Notes
6. **Add Print** using `PrintReportButton`
7. **Import** `Download`, `Search`, `Printer` from lucide-react and `PrintReportButton`

### Technical Details

- Date filtering: `(!dateFrom || dateField >= dateFrom) && (!dateTo || dateField <= dateTo)`
- Pastoral Care uses `created_at.split("T")[0]` for date comparison
- Transportation uses `request_date` field directly
- CSV uses Blob + anchor click pattern (consistent with ChurchAttendance and Followups)
- `assigneeMap` used in Pastoral Care exports to resolve assigned_to IDs to names

