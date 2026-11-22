# Add "Guided Tour" as a church feature switch

## What changes
- A new **Guided Tour** switch appears in the church feature list (Tenant Admin → Modules and Settings → Features), on by default.
- When switched off for a church:
  - Tours never start on their own.
  - The "Take the tour" / Tour buttons in page headers are hidden.
  - The "Onboarding tours — Replay all tours" box in Settings is hidden.
- Fix found while checking: the Certificates switch is saved as `/certificates`, but last change checked `/certificates-report`, so the certificates tour step and My Profile certificates section would not hide. Point both at `/certificates`.

## Technical details
- `src/lib/feature-modules.js`: add `{ key: "tour", label: "Guided Tour", description: "Step-by-step help tours on each page" }` (path `/tour`).
- `TourProvider.startTour`: return early when `/tour` is off (covers auto tours and manual starts).
- `HelpButton.jsx` and `ReplayToursSection.jsx`: render nothing when `useTenantFeatureEnabled("/tour")` is false.
- `tours.js` step feature and `MyProfile.jsx` check: change `/certificates-report` to `/certificates`.
- Extend `useSubFeature.test.js`: tour off → no steps start; certificates step skipped when `/certificates` is off.
