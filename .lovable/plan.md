# Move Teens Attendance into Children Church

Merge the standalone Teens Attendance page into the Children Church page as a new **Teens** tab, and remove the standalone route/sidebar entry.

## Changes

### 1. `src/pages/TeensAttendance.jsx`
- Rename the default-exported `TeensAttendance()` component so its inner content (header, filters, sessions list, dialogs) becomes an exported panel: `export function TeensAttendancePanel()`.
- Drop the outer page padding wrapper (`p-4 max-w-…`) so it renders cleanly inside a `TabsContent`. Keep the page-level `<h1>`/description out — the parent page already has its own header; a smaller section heading stays inside the panel.
- Keep the default export for backward compatibility (re-export a thin wrapper that renders `<TeensAttendancePanel />` inside a page container) — safe fallback if any deep link hits the old route.

### 2. `src/pages/ChildrenChurch.jsx`
- Import `TeensAttendancePanel` from `@/pages/TeensAttendance`.
- Import `useTeensUnitRole` from `@/hooks/useTeensUnitRole` to determine visibility.
- Show a new **Teens** tab when the user is admin, Children Church leader, or a Teens unit leader/member (`isLeader || isAdmin || teensRole.isMember`). This preserves existing Teens Attendance access rules.
- Add the tab to the `TabsList` (recomputed `tabCount`) and a `<TabsContent value="teens">` rendering `<TeensAttendancePanel />`.
- Tab order: Check-in · Pickup · **Teens** · All children · Report.

### 3. `src/components/AppLayout.jsx`
- Remove the sidebar item at line 51 (`{ name: "Teens Attendance", … path: "/teens-attendance" }`) so Teens Attendance is only reachable via the Children Church → Teens tab.

### 4. `src/App.jsx`
- Remove the `/teens-attendance` route (line 200) and the `TeensAttendance` lazy import (line 58). Anyone hitting the old URL will fall through to the NotFound route; the Children Church tab is the new home.

### 5. Notification deep-links (`src/components/notifications/NotificationBell.jsx`)
- Update any Teens-attendance notification link that points to `/teens-attendance` so it routes to `/children-church` (with the Teens tab). Simplest: change the target path; the tab picker stays on default but users land on the correct page. (If we later want to auto-select the tab, we'd add a `?tab=teens` query param — out of scope unless requested.)

## Out of scope
- No database, RPC, or edge-function changes.
- No UI redesign of the Teens Attendance features themselves — sessions, roster, reports, cumulative report all keep working exactly as today, just hosted under the Children Church tab.
- Teens registration UI in `MyFamily` and the `/teens/checkin/:token` public route are untouched.
