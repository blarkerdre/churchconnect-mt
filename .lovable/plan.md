

## Fix: Show Dashboard Banner for Unit Leaders and Home Cell Leaders

### Root Cause
The `Dashboard.jsx` routing logic sends:
- **Home Cell (WSF) leaders** → `WSFLeaderDashboard` component, which does NOT render `<DashboardBanner />`
- **Unit leaders** (who are not also WSF leaders) → `MemberDashboard`, which DOES render the banner — so they should already see it

The fix is simply adding `<DashboardBanner />` to `WSFLeaderDashboard`.

### Changes

**`src/components/dashboard/WSFLeaderDashboard.jsx`**
- Import `DashboardBanner` from `@/components/dashboard/DashboardBanner`
- Add `<DashboardBanner />` at the top of the returned JSX (before the welcome/stats section), matching the same placement used in `MemberDashboard`

### Files Changed
- `src/components/dashboard/WSFLeaderDashboard.jsx` (2-line addition: import + render)

