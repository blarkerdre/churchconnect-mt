

## Add Date Filter, Print & Download to Follow-ups

### Changes

**`src/pages/Followups.jsx`**:

1. **Add state** for `dateFrom` and `dateTo` (strings, empty default)

2. **Add date filter inputs** in the controls area (lines 222-237) — two `<Input type="date">` for From/To dates alongside the existing search and status filter

3. **Update filtering logic** (line 164-168) to also filter by date range using `created_at` (or `due_date`):
   ```js
   const dateOnly = f.due_date || f.created_at?.split("T")[0];
   const matchDate = (!dateFrom || dateOnly >= dateFrom) && (!dateTo || dateOnly <= dateTo);
   return matchSearch && matchStatus && matchDate;
   ```

4. **Add Download CSV button** in the controls area that exports filtered followups with columns: Name, Type, Status, Priority, Assigned To, Due Date, Completed Date, Notes

5. **Add Print button** using existing `PrintReportButton` component with the same columns

6. **Import** `Download` icon from lucide-react and `PrintReportButton` component

### Technical Details

- Date filtering uses `due_date` field (falls back to `created_at` date portion)
- CSV download uses `Blob` + anchor click pattern (same as ChurchAttendance)
- Print uses `PrintReportButton` with `buildRows` returning filtered data
- `profileMap` used to resolve `assigned_to` IDs to names in exports
- Stats cards (lines 215-220) will reflect filtered data for consistency

