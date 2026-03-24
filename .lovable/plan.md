

## Restrict Print, Filter, and Download to Admins & Unit Leaders

Currently, several pages expose print, filter, and download controls to all authenticated users. This plan gates those controls behind admin or unit leader role checks.

### Pages to Update

1. **`src/pages/ChurchAttendance.jsx`**
   - Import `isAdmin, isUnitLeader` from `useAuth()` (currently only imports `user`)
   - Wrap date filter inputs, service type filter, Download button, and PrintReportButton in `(isAdmin || isUnitLeader)` conditional

2. **`src/pages/PastoralCare.jsx`**
   - Already has `canManage` (admin or pastoral unit). Wrap the date filters, status filter, CSV button, and PrintReportButton in a `canManage` check

3. **`src/pages/Followups.jsx`**
   - Import `isUnitLeader` from `useAuth()` (currently only has `isAdmin`)
   - Wrap Download button and PrintReportButton in `(isAdmin || isUnitLeader)` conditional
   - Wrap date filters and status filter in the same conditional

4. **`src/pages/Attendance.jsx`**
   - Already has `isAdmin, isUnitLeader` and `canManage`. Wrap Download button and PrintReportButton in `canManage` check

5. **`src/pages/Members.jsx`**
   - CSV download is already gated by `isAdmin`. Expand to `(isAdmin || isUnitLeader)` so unit leaders can also export

### What stays unchanged
- TrainingReports.jsx (already uses sub-feature toggles for CSV/print)
- SystemLogs.jsx (page is admin-only)
- Events.jsx (no download/print features)
- WSFManagement.jsx (no download/print features)

