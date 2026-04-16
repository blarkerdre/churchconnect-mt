

## Remove Sections from Home Cell Leader Dashboard

### Problem
The Home Cell leader dashboard currently shows "Record Attendance", "View Members" quick action cards, and a "Members by Centre" section that should not be there.

### Changes

**`src/components/dashboard/WSFLeaderDashboard.jsx`**

1. **Remove the Quick Actions section** (lines 182–212) — the entire grid containing "Record Attendance" and "View Members" cards
2. **Remove the Members by Centre section** (lines 244–266) — the card showing centre member counts
3. Clean up any unused imports (`Link` from react-router-dom if no longer used elsewhere, and potentially `UserPlus`, `UserMinus` icons if unused)

Everything else stays: welcome banner, self check-in, stats cards, attendance trends chart, recent reports, rate this app, and the feed.

### Files Changed
- `src/components/dashboard/WSFLeaderDashboard.jsx` — remove 3 sections (~35 lines)

