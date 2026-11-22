# Hide switched-off features in the tour and on other pages

## What changes for churches
- **Guided tour**: steps about a switched-off feature are skipped (e.g. the Certificates step on My Profile, sidebar steps that mention Bible School or Home Cell). Whole tours for switched-off pages are skipped too, including in "Replay tours" in Settings and the Tour/Help button.
- **Buttons, tabs and links**: anything on another page that leads into a switched-off feature is hidden. This covers Testimony, Children Church (incl. Teens/Preteens tabs), Bible School (courses, exams, certificates), Home Cell, Pastoral Care, Transport, Sermon Notes, Birthdays, My Family, Training and the rest of the switchable features.
- Places covered: dashboard cards and quick links, notification bell links, My Profile sections, member profile tabs, Reports/Training reports, Settings tabs and menus.
- Pages themselves stay blocked as today when opened directly.

## Technical details
- `tours.js`: add an optional `feature: "/route"` to tours and steps; `resolveSteps` drops steps whose feature is off. `TourProvider` passes an `isFeatureEnabled(path)` helper (same logic as `useTenantFeatureEnabled`) into the ctx; `ReplayToursSection`, `HelpButton`, `useAutoTour` skip tours whose feature is off.
- Extract a pure `isTenantFeatureEnabled(tenant, path)` in `useSubFeature.js`, reused by the hook and the tour (unit-tested with a small vitest file).
- Sweep with `rg` for links/navigations/tabs pointing at each feature route (`/testimony`, `/children-church`, `/wofbi*`, `/wsf*`, `/pastoral-care`, `/transportation`, `/sermon-notes`, `/my-family`, `/certificates`, `/exams`, etc.) outside their own page, and wrap each with `useTenantFeatureEnabled`.
- Super admins follow the same hiding in the app (consistent with the previous change).
