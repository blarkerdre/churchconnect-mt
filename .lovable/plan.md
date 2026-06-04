# Move Analytics into Reports Hub + Admin-only Feedback

## Context
- `/analytics` route already exists and is gated by `ReportsRoute` (admin or Reports Officer).
- Reports Hub (`/reports`) already lists Analytics as its first card.
- Sidebar currently shows BOTH "Reports Hub" and a separate "Analytics" entry.
- Sidebar Feedback button is currently visible to everyone.

## Changes

### 1. `src/components/AppLayout.jsx`
- Remove the standalone `{ name: "Analytics", icon: BarChart2, path: "/analytics", access: "reports" }` nav item so Analytics is only reachable via Reports Hub. The `/analytics` route itself stays (Reports Hub links to it).
- Wrap the Feedback button (lines ~350–357) so it only renders when `isAdmin` is true. Reports Officer and other roles will no longer see it.

## Out of scope
- No route changes, no auth/role logic changes, no edits to `Analytics.jsx` or `Reports.jsx`.
- App feedback dialog component itself is unchanged.
- No backend/RLS changes.
