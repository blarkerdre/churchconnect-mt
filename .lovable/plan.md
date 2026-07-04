# Guided tours for every module

Extend the existing spotlight tour system (already used on My Family and Children Church) to cover every feature module in the app. Each module gets its own tour that auto-runs the first time a user opens it and can be re-launched from a Tour button in the page header.

## What's already in place (reused, not rebuilt)

- `TourProvider` + `SpotlightOverlay` — SVG-mask spotlight, tooltip with Back/Next/Skip, keyboard nav, mobile fallback.
- `HelpButton` (Tour button) — drops into any page header.
- `tours.js` — declarative step definitions, optional `when: (ctx) => boolean` for role-gated steps.
- `useTourCompletion` hook + `user_tour_completions` table — per-user, per-tour persistence with localStorage cache.

No changes to the framework itself.

## Modules covered

One tour per module, keyed by a stable id (e.g. `members-v1`, `events-v1`, …):

1. Dashboard (`dashboard-v1`) — sidebar overview, banner, feed, notifications bell, tenant switcher
2. Members (`members-v1`) — directory, add member, bulk import, filters, member profile, status lifecycle
3. Events (`events-v1`) — create event, delivery mode, audience, registrations, reactions
4. Attendance (`attendance-v1`) — session list, create session, check-in panel, self check-in
5. Church Attendance (`church-attendance-v1`) — report entry, demographics, visual trends
6. Follow-ups (`followups-v1`) — inbox, create follow-up, referrals, templates, signposts
7. Pastoral Care (`pastoral-care-v1`) — requests, assignments, life events, history
8. Communications (`communications-v1`) — announcements, direct send, messaging, history, contacts
9. Transportation (`transportation-v1`) — bookings, driver availability, route planner, report
10. Analytics (`analytics-v1`) — charts, absence alerts, milestone/conversion reports, re-engagement
11. Bible School (`exam-management-v1`) — sessions, subjects, register, take exam, results
12. Training Reports (`training-reports-v1`) — programs, attendees, completions
13. Home Cell (`wsf-v1`) — centres, attendance, my centre members, zones
14. Sermon Notes (`sermon-notes-v1`) — folders, new note, rich editor, handwriting pad
15. Testimony (`testimony-v1`) — write, categories, share
16. Unit Tasks (`unit-tasks-v1`) — task groups, assignments, comments, report, roster
17. Inventory (`inventory-v1`) — items, categories, inspections, history
18. Reports Hub (`reports-v1`) — read-only cross-module view for Reports Officer
19. Settings (`settings-v1`) — modules, branding, templates, danger zone, external links
20. Tenant Admin (`tenant-admin-v1`, super-admin only) — tenants, users, billing, analytics, integrations
21. My Profile (`my-profile-v1`) — profile completion, feed, certificates, notifications
22. My Family (`my-family-v1`) — already shipped
23. Children Church (`children-church-v1`) — already shipped

Tours for features the tenant has disabled (via `FEATURE_MODULES` / `disabled_features`) simply don't get auto-launched — the module isn't in the sidebar.

## Wiring pattern per page (identical for all)

For each page above:

1. Add `data-tour="<id>"` attributes to 4–7 anchor elements (header, primary action, main table/list, filters, one representative item, key tab).
2. In the page header, render `<HelpButton tourId="<module>-v1" dataTour="<module>-help" />` next to the existing title/actions.
3. Add the auto-launch hook (same 4 lines already used on My Family / Children Church):

   ```jsx
   const { completed } = useTourCompletion("<module>-v1");
   const tour = useTour();
   useEffect(() => {
     if (completed === false) {
       const t = setTimeout(() => tour.startTour("<module>-v1", { isAdmin, isLeader }), 600);
       return () => clearTimeout(t);
     }
   }, [completed, isAdmin, isLeader]);
   ```

4. Add the step definitions to `src/components/tour/tours.js`. Role-gated steps use `when: (ctx) => ctx.isAdmin` etc. so workers don't see admin-only anchors.

## Ctx passed to tours

Extend the ctx passed into `resolveSteps` to cover all role checks used across modules:
`{ isAdmin, isTenantAdmin, isTenantOwner, isSuperAdmin, isLeader, isWSFLeader, isUnitLeader, isReportsOfficer, isPastor }`. Populated from `useAuth()` inside `TourProvider.startTour`.

## Global "Take the app tour" entry point

On the Dashboard, add one extra button: **Take the app tour** — launches `dashboard-v1`, which is a short (5–6 step) overview of the sidebar, notifications, tenant switcher, and profile menu. This is the first-run tour every new user sees when they land on `/`.

## Reset / re-run

Add a small **Restart onboarding tours** button in Settings → Profile that clears the user's `user_tour_completions` rows and localStorage keys, so a user can replay every tour if they want.

## Out of scope

- No changes to feature business logic — tours are pure UI overlays.
- No admin editor for tour content (steps live in `tours.js`).
- No analytics on tour completion beyond the existing `user_tour_completions` table.
- No changes to the existing DB schema.

## Files touched

- `src/components/tour/tours.js` — add ~20 new tour definitions.
- `src/components/tour/TourProvider.jsx` — expand ctx passed to `resolveSteps`.
- Each page in the list above — add `data-tour` attrs, `<HelpButton />`, and the auto-launch hook.
- `src/pages/Settings.jsx` (or MyProfile) — add "Restart onboarding tours" button.
- `src/pages/Dashboard.jsx` — add the "Take the app tour" entry button.

No new files, no migrations.
