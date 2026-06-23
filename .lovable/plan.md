## Change

In `src/pages/ChildrenChurch.jsx`, tighten tab visibility so Children Church unit members no longer see the "All children" tab.

- `canSeeAll = isLeader || isAdmin` (was `isUnitMember || isLeader || isAdmin`)
- `canSeeReport = isLeader || isAdmin` (unchanged)

Resulting tabs:
- Unit members → Check-in, Pickup
- Leaders / Admins → Check-in, Pickup, All children, Report

No changes to Check-in/Pickup search (unit members keep the guardian-lookup access added previously). No DB/RLS changes.
