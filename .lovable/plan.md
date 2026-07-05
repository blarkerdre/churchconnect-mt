
# Make every module's tour behave exactly like My Family / Children Church

## What "exactly like" means

On My Family and Children Church, the tour is wired **inside the page itself**:

1. The page imports `HelpButton`, `useTour`, `useTourCompletion`.
2. A `useEffect` auto-launches the page's tour ~600ms after mount when `completed === false`.
3. A `<HelpButton tourId="…" dataTour="…" />` sits next to the page title so the user can re-open it any time.
4. Real UI elements on the page carry `data-tour="…"` attributes so the spotlight lands on actual buttons/tabs/cards — not a centered fallback modal.

The rest of the app currently only gets step 2 (via the centralized `RouteTourController` in `AppLayout`) and none of the anchors — so tours always fall back to a centered modal. This plan fixes that.

## Changes

### 1. Remove the centralized indirection

- Delete `RouteTourController` from `src/components/AppLayout.jsx` and remove the global `<HelpButton>` from the app header.
- Remove `ROUTE_TOURS` export from `src/components/tour/tours.js` (no longer needed — each page owns its tour id).
- Keep `TourProvider`, `HelpButton`, `SpotlightOverlay`, `useAutoTour` and `useTourCompletion` unchanged.

### 2. Wire every module page the same way as MyFamily.jsx

For each page listed below, add the same 4 things:

```jsx
import HelpButton from "@/components/tour/HelpButton";
import { useAutoTour } from "@/hooks/useAutoTour";

// inside the component:
useAutoTour("<module>-v1", { isAdmin, isLeader /* etc */ });

// in the page header row, next to the title:
<HelpButton tourId="<module>-v1" dataTour="<module>-help" />
```

Then attach `data-tour="…"` to the specific elements the tour's step selectors already reference in `src/components/tour/tours.js`.

Pages to wire (tour id ↔ anchors already defined in `tours.js`):

| Page file | Tour id | Anchors to add |
|---|---|---|
| `src/pages/Dashboard.jsx` | `dashboard-v1` | `dashboard-help`, `dashboard-feed` (bell + tenant-switcher + sidebar-nav already exist in AppLayout) |
| `src/pages/MyProfile.jsx` | `my-profile-v1` | `my-profile-help`, `profile-completion`, `profile-feed`, `my-certificates` |
| `src/pages/Members.jsx` | `members-v1` | `members-help`, `members-add`, `members-import`, `members-filters`, `members-table` |
| `src/pages/Events.jsx` | `events-v1` | `events-help`, `events-create`, `events-list` |
| `src/pages/ChurchUnit.jsx` | `church-unit-v1` | `church-unit-help`, `unit-members` |
| `src/pages/Attendance.jsx` | `attendance-v1` | `attendance-help`, `attendance-create`, `attendance-checkin` |
| `src/pages/ChurchAttendance.jsx` | `church-attendance-v1` | `church-attendance-help`, `ca-new-report`, `ca-trends` |
| `src/pages/Followups.jsx` | `followups-v1` | `followups-help`, `followups-new`, `followups-referrals`, `followups-templates` |
| `src/pages/PastoralCare.jsx` | `pastoral-care-v1` | `pastoral-care-help`, `pc-request`, `pc-assign` |
| `src/pages/Communications.jsx` | `communications-v1` | `communications-help`, `comms-announcement`, `comms-direct`, `comms-history` |
| `src/pages/Transportation.jsx` | `transportation-v1` | `transportation-help`, `transport-book`, `transport-drivers` |
| `src/pages/Analytics.jsx` | `analytics-v1` | `analytics-help`, `analytics-charts`, `analytics-absence`, `analytics-conversion` |
| `src/pages/ExamManagement.jsx` | `exam-management-v1` | `exam-management-help`, `exam-sessions`, `exam-take`, `exam-results` |
| `src/pages/TrainingReports.jsx` | `training-reports-v1` | `training-reports-help`, `training-attendees` |
| `src/pages/WSFManagement.jsx` | `wsf-v1` | `wsf-help`, `wsf-attendance`, `wsf-members` |
| `src/pages/SermonNotes.jsx` | `sermon-notes-v1` | `sermon-notes-help`, `sn-folders`, `sn-new` |
| `src/pages/Testimony.jsx` | `testimony-v1` | `testimony-help`, `testimony-new` |
| `src/pages/UnitTasks.jsx` | `unit-tasks-v1` | `unit-tasks-help`, `tasks-new`, `tasks-report` |
| `src/pages/Inventory.jsx` | `inventory-v1` | `inventory-help`, `inv-items`, `inv-inspections` |
| `src/pages/Reports.jsx` | `reports-v1` | `reports-help` |
| `src/pages/Settings.jsx` | `settings-v1` | `settings-help`, `settings-modules`, `settings-branding`, `settings-danger` (`settings-restart-tours` already present) |
| `src/pages/TenantAdmin.jsx` | `tenant-admin-v1` | `tenant-admin-help`, `ta-tenants`, `ta-billing`, `ta-integrations` |
| `src/pages/UserManagement.jsx` | `user-management-v1` | `user-management-help`, `um-invite`, `um-roles` |

`MyFamily.jsx` and `ChildrenChurch.jsx` stay as they are — they're already the reference implementation.

### 3. Update tour step selectors

Each tour step in `tours.js` that currently uses the shared `genericHeader = '[data-tour="page-help"]'` gets swapped to that page's own `<module>-help` selector so the first step spotlights the page's real Tour button (same UX as `mf-help` / `cc-help` today). No copy changes.

### 4. Behaviour after this change

- First visit to a module → the tour auto-opens with a real spotlight over the module's own controls.
- Any subsequent visit → nothing auto-opens; the "?" Tour button in the page header re-launches it.
- Skip / Finish still writes to `user_tour_completions` and localStorage exactly as today.
- Settings → "Replay all tours" continues to reset every module (unchanged).

## Out of scope

- No changes to `TourProvider`, `SpotlightOverlay`, `HelpButton`, `useAutoTour`, `useTourCompletion`, or the `user_tour_completions` table.
- No new tours, no copy rewrites, no analytics changes, no business-logic changes.
