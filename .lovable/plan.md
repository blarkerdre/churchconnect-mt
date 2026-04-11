

## Fix Feature Toggle for Tenants + Add Sermon Notes

### Issues Found
1. **Sermon Notes missing from toggle list** — `FEATURE_MODULES` in `TenantAdmin.jsx` doesn't include `sermon-notes`, so Super Admins can't disable it for tenants.
2. **Sermon Notes route unprotected** — In `App.jsx`, the `/sermon-notes` route has no `FeatureGate` wrapper, so even if it were added to `disabled_features`, users could still access it via direct URL.
3. Everything else (Members, Events, Attendance, etc.) is correctly wired with both `FeatureGate` and sidebar filtering — those work properly.

### Changes

**`src/pages/TenantAdmin.jsx`** — Add Sermon Notes to `FEATURE_MODULES` array:
```js
{ key: "sermon-notes", label: "Sermon Notes", description: "Sermon notes management" },
```

**`src/App.jsx`** — Wrap the Sermon Notes route with `FeatureGate`:
```jsx
// Before:
<Route path="/sermon-notes" element={<SermonNotes />} />

// After:
<Route path="/sermon-notes" element={<FeatureGate path="/sermon-notes"><SermonNotes /></FeatureGate>} />
```

### No database changes needed
The `disabled_features` array in `tenants.settings` JSONB already supports arbitrary paths — no migration required.

### Files changed
- **Edit**: `src/pages/TenantAdmin.jsx` — add sermon-notes to FEATURE_MODULES
- **Edit**: `src/App.jsx` — add FeatureGate to sermon-notes route

