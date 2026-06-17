## Goal
Create a new "Church Unit" page that consolidates the existing **Unit Tasks** and **Unit Meeting & Attendance** sections under a single, tabbed page. Remove their separate top-level sidebar entries.

## Changes

### 1. New page: `src/pages/ChurchUnit.jsx`
- Page wrapper with header "Church Unit".
- Tabs (shadcn `Tabs`):
  - **Meetings & Attendance** — renders the existing Attendance page content.
  - **Unit Tasks** — renders the existing Unit Tasks page content.
- Default tab driven by `?tab=` query param (`attendance` | `tasks`) so deep links keep working; falls back to `attendance`.
- Visibility/access: visible to any authenticated user (tasks tab is open to all today); the Attendance tab gates its own actions internally as it already does (leaders/admins).

### 2. Refactor existing pages into embeddable views
To avoid duplicating logic, extract the body of each page into a reusable view component, then have the existing route render the view inside its current shell:
- `src/pages/Attendance.jsx` → keep route, but export inner content as `AttendanceView` (or import from a new `src/components/attendance/AttendanceView.jsx`).
- `src/pages/UnitTasks.jsx` → same pattern → `UnitTasksView`.
- `ChurchUnit.jsx` renders `<AttendanceView />` and `<UnitTasksView />` inside its tabs.

If extraction is risky, the simpler alternative is to import the page components directly into the tabs and drop the standalone routes — see Routing below.

### 3. Routing (`src/App.jsx`)
- Add lazy import: `const ChurchUnit = lazy(() => import("@/pages/ChurchUnit"));`
- Add route `/church-unit` → `<ProtectedRoute><ChurchUnit /></ProtectedRoute>`.
- Keep `/attendance` and `/unit-tasks` routes as redirects to `/church-unit?tab=attendance` and `/church-unit?tab=tasks` so existing links (Reports Hub, deep links, audit logs, notifications) don't break.

### 4. Sidebar (`src/components/AppLayout.jsx`)
- Remove the two existing nav entries:
  - `Unit Meeting & Attendance` (`/attendance`)
  - `Unit Tasks` (`/unit-tasks`)
- Add one new entry:
  - `{ name: "Church Unit", icon: ClipboardList, path: "/church-unit", access: null }`
  - Positioned where Unit Meeting & Attendance currently sits.

### 5. Cross-references
- `src/pages/Reports.jsx`: update the two report tiles to point at `/church-unit?tab=attendance` and `/church-unit?tab=tasks`.
- `src/lib/feature-modules.js`: leave the `attendance` module key as-is (still controls underlying feature), but rename the label to "Church Unit (Meetings & Tasks)" if it appears in admin toggles — confirm during implementation.

## Out of scope
- No DB/schema/edge-function changes.
- No changes to attendance session types, unit task model, or RLS policies.
- Self-check-in widget and dashboard links continue to work via the `/attendance` redirect.

## Technical notes
- `AttendanceView`/`UnitTasksView` extraction keeps current behavior (hooks, role gating, internal dialogs) intact — only the outer `<div className="container ...">` wrapper moves up to the new page.
- Tab state synced to URL via `useSearchParams` so the redirected legacy routes land on the right tab.
