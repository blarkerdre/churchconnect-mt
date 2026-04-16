

## Add Upcoming Birthdays for Home Cell and Unit Leaders

### Overview
Add a birthday section to both the WSF Leader Dashboard (Home Cell leaders) and the Member Dashboard (which unit leaders see), showing upcoming birthdays scoped to only their assigned members.

### Changes

**1. `src/components/dashboard/WSFLeaderDashboard.jsx`**
- Query `members` table for members in `centreIds` (already fetched) with `date_of_birth` set, then filter client-side for birthdays in the next 7 days (same month/day logic)
- Display using the existing `UpcomingBirthdayItem` component from `BirthdayCelebration.jsx`
- Place the birthday card after the stats cards, before attendance trends
- Import `Cake` icon and `UpcomingBirthdayItem`

**2. `src/components/dashboard/MemberDashboard.jsx`**
- For unit leaders: query upcoming birthdays using the existing `get_upcoming_birthdays` RPC, then filter client-side to only members whose `church_unit` matches the leader's `leaderUnits`
- For regular members: skip the section (they don't need to see other members' birthdays)
- Display using `UpcomingBirthdayItem` and `Cake` icon
- Place before the growth milestones section
- Import `useAuth` to get `isUnitLeader`, `leaderUnits` (already imported)

### Technical detail
- WSF leaders: fetch `date_of_birth` in the existing `centreMembers` query (add it to select), then compute upcoming birthdays client-side using day/month comparison within 7 days
- Unit leaders: reuse the `get_upcoming_birthdays` RPC and filter results by `church_unit` matching `leaderUnits`
- Both use the `UpcomingBirthdayItem` component already built

### Files Changed
- `src/components/dashboard/WSFLeaderDashboard.jsx` — add birthday query and card
- `src/components/dashboard/MemberDashboard.jsx` — add birthday card for unit leaders

