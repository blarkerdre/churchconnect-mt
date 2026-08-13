# Add "My Family" and "Dashboard Slideshow" to tenant module toggles

Both features are currently always on and cannot be switched off per church in Tenant Admin → Modules (and the Onboarding feature list). This adds them as toggleable modules.

## What changes

1. **My Family** appears in the module list. When switched off for a church:
   - the "My Family" sidebar link is hidden,
   - the `/my-family` route is blocked like other disabled modules.

2. **Dashboard Slideshow** appears in the module list. When switched off:
   - the banner/slideshow carousel at the top of the member dashboard is hidden,
   - the "Dashboard Slideshow" settings card is hidden from Settings.

No data is deleted by turning either off — content stays and reappears when re-enabled.

## Technical details

- `src/lib/feature-modules.js`: add two entries
  - `{ key: "my-family", label: "My Family", description: "Family profile, children and teens registered by parents" }`
  - `{ key: "dashboard-slideshow", label: "Dashboard Slideshow", description: "Banner and Book of the Month carousel on the dashboard" }`
  These flow automatically into `TenantFeaturesSection.jsx` and Tenant Admin, storing `/my-family` and `/dashboard-slideshow` in `tenants.settings.disabled_features`.
- Route/sidebar gating for `/my-family` already works generically via the `disabled_features` checks in `src/App.jsx` (line ~183) and `src/components/AppLayout.jsx` (line ~112) — verify the nav entry and route are covered by those filters and add them to the filtered lists if they are hardcoded outside them.
- `dashboard-slideshow` is not a route, so gate it explicitly with `useTenantFeatureEnabled("/dashboard-slideshow")` from `src/hooks/useSubFeature.js`:
  - wrap `<DashboardBanner />` in `src/components/dashboard/MemberDashboard.jsx`,
  - hide `DashboardBannerSettings` in the Settings page when disabled.
