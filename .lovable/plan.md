

## Plan: Clean up unused logs directory + Add date filtering and CSV download

### 1. Delete unused files
Remove the three orphaned component files that are no longer imported:
- `src/components/logs/EmailLogsTab.jsx`
- `src/components/logs/SMSLogsTab.jsx`
- `src/components/logs/AuditLogsTab.jsx`

### 2. Add date/time range filtering to all tabs
Update `src/pages/SystemLogs.jsx`:

**Email tab** — Replace the preset time-range buttons with a date-range picker (From / To) using Popover + Calendar. Keep existing template and status filters. Query uses `.gte("created_at", fromDate).lte("created_at", toDate)`.

**SMS tab** — Add the same From/To date picker. Query filters by date range instead of fetching latest 100.

**Audit tab** — Add From/To date picker alongside existing search and action filter.

All three default to "last 7 days" on mount.

### 3. Add CSV download button to each tab
Add a "Download CSV" button next to the filters in each tab panel. On click, it serializes the currently filtered/visible log data into a CSV blob and triggers a browser download.

- **Email CSV columns**: Template, Recipient, Status, Time, Error
- **SMS CSV columns**: Phone, Type, Status, Delivery Status, Message, Time, Error
- **Audit CSV columns**: Actor, Action, Entity Type, Details, Time

### 4. Shared helper
Create a small `downloadCSV(rows, headers, filename)` utility function at the top of `SystemLogs.jsx` to avoid repeating blob/download logic across tabs.

### Technical details
- Date pickers use existing `Calendar` + `Popover` components (shadcn)
- `pointer-events-auto` on Calendar per project convention
- CSV generation is pure client-side (no backend changes)
- No new dependencies needed — `date-fns` `format` already imported
- Single file change: `src/pages/SystemLogs.jsx`
- Three file deletions: the `src/components/logs/` directory contents

