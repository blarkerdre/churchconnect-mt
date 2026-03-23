

## Super Admin Feature Toggle

### Overview
Super Admins can enable/disable app features from Settings. Disabled features are hidden from navigation and their routes redirect to the dashboard.

### Data
Store in `app_settings` with key `disabled_features` as a JSON array of route paths (e.g. `["/transportation", "/analytics"]`). No migration needed.

### Changes

**1. New Settings tab — `src/pages/Settings.jsx`**
- Add a "Features" tab (visible only to super admins)
- Show a checklist of all toggleable features (everything except Dashboard, My Profile, Settings, User Management, System Logs)
- Each feature has a switch; toggling updates the `disabled_features` array in `app_settings`

**2. Sidebar filtering — `src/components/AppLayout.jsx`**
- Fetch `disabled_features` using `useAppSetting("disabled_features", [])`
- Filter out nav items whose path is in the disabled list (super admins still see all features)

**3. Route protection — `src/App.jsx`**
- Create a `FeatureGate` wrapper component that checks `disabled_features`
- If the current route is disabled, redirect to `/`
- Super admins bypass the gate
- Wrap toggleable routes with `FeatureGate`

**4. Hook enhancement — `src/hooks/useAppSetting.jsx`**
- Already works for this use case, no changes needed

### Features that can be toggled
Members, Events, Unit Attendance, Follow-ups, Pastoral Care, Communications, Transportation, Analytics, BFC Report, Church Attendance, WoFBI, WSF Centres

### Features that cannot be toggled (core)
Dashboard, My Profile, User Management, Settings, System Logs

