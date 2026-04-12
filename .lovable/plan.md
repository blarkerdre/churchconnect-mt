

## Add Testimony as Sidebar Feature

### Summary
Move testimony from a dashboard card to a dedicated sidebar navigation item with its own page. Add it to the landing page features and ensure it's tenant-scoped and toggleable.

### Changes

**1. New page: `src/pages/Testimony.jsx`**
- Page with title "Share Your Testimony" and the existing `TestimonyFormDialog` content rendered inline (not as a dialog)
- Shows the three-field form directly on the page

**2. Update sidebar: `src/components/AppLayout.jsx`**
- Add nav item: `{ name: "Testimony", icon: MessageSquareHeart, path: "/testimony", access: null }`
- Import `MessageSquareHeart` from lucide-react

**3. Add route: `src/App.jsx`**
- Add `/testimony` route wrapped in `FeatureGate`
- Import the new Testimony page

**4. Add to feature toggles: `src/pages/TenantAdmin.jsx`**
- Add `{ key: "/testimony", label: "Testimony", description: "Member testimony sharing" }` to `FEATURE_MODULES`

**5. Remove from dashboard: `src/components/dashboard/MemberDashboard.jsx`**
- Remove the "Share Testimony" card and `TestimonyFormDialog` from the dashboard
- Remove related imports and state

**6. Update landing page: `src/pages/LandingPage.jsx`**
- Add `{ icon: MessageSquareHeart, title: "Testimony Sharing", desc: "Members can share what the Lord has done in structured testimony reports." }` to features array

**7. Update mobile nav consideration**
- The testimony page will be accessible via sidebar; no mobile bottom nav change needed (already has 5 tabs)

### Files changed
- **New**: `src/pages/Testimony.jsx`
- **Edit**: `src/components/AppLayout.jsx` — add sidebar item
- **Edit**: `src/App.jsx` — add route with FeatureGate
- **Edit**: `src/pages/TenantAdmin.jsx` — add to FEATURE_MODULES
- **Edit**: `src/components/dashboard/MemberDashboard.jsx` — remove testimony card
- **Edit**: `src/pages/LandingPage.jsx` — add testimony to features grid

