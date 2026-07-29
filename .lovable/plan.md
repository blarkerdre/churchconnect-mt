## Goal
Make Children Church the single home for child check-in/pickup, Preteens attendance and Teens attendance, instead of three separate sidebar entries.

## What changes

**One page, grouped tabs** (`/children-church`):

```text
Children Church
 ├── Children:  Check-in | Pickup | All children | Report
 ├── Preteens:  (Preteens attendance screen)
 └── Teens:     (Teens attendance screen)
```

- Add two new top-level tabs, `Preteens` and `Teens`, alongside the existing children tabs. Existing children tabs keep their current labels and behaviour.
- The Preteens tab renders the current Preteens attendance screen; the Teens tab renders the current Teens attendance screen. No logic inside those screens changes.

**Access rules (unchanged, just applied per tab)**
- Preteens tab shows only for Admins / Reports Officer / Children's Church leaders and members (same rule as today's Preteens page).
- Teens tab shows only for Admins / Reports Officer / Teens Church leaders and members (same rule as today's Teens page). A Children's Church worker who isn't in Teens Church will not see the Teens tab.
- Default tab is the first one the user is allowed to see, so a Teens-only worker landing on Children Church goes straight to Teens.

**Navigation**
- Remove the "Teens Attendance" and "Preteens Attendance" sidebar items; keep a single "Children Church" item, visible to anyone with children's, preteens, or teens access.
- Keep `/teens-attendance` and `/preteens-attendance` working as redirects to `/children-church?tab=teens` / `?tab=preteens` so existing links, QR landing redirects and bookmarks don't break.
- Support a `?tab=` query parameter on the Children Church page for deep links.

**Not changed**
- Public QR check-in routes (`/t/:slug/teens/checkin`, `/t/:slug/preteens/checkin`) stay exactly as they are.
- Database, RLS policies, reports and My Family registration sections are untouched.

## Technical notes
- Extract the body of `TeensAttendance.jsx` and `PreteensAttendance.jsx` into embeddable components (or export the existing default and render it inside the tab) and mount them lazily so the Children Church bundle stays small.
- Role gating uses the existing `useTeensUnitRole` / `usePreteensUnitRole` hooks plus `isAdmin` / `isReportsOfficer` from `useAuth`.
- Tab state synced to the URL via `useSearchParams`.
- `AppLayout.jsx` nav access for "Children Church" becomes the union of `children_church` and `teens` access checks.
