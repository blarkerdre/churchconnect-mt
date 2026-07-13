## Plan: Add Phone Call & WhatsApp modules + auto-sync feature list

### 1. Add missing modules to `src/lib/feature-modules.js`
Append two entries so they show up in Tenant Admin → Modules:
- `phone-call` — "Phone Call" — Outbound phone calls via configured voice provider (Twilio/etc.)
- `whatsapp` — "WhatsApp" — WhatsApp messaging via configured provider

### 2. Auto-update behavior
`TenantFeaturesSection.jsx` already renders by mapping over `FEATURE_MODULES`. So any new entry added to `src/lib/feature-modules.js` automatically appears in Tenant Admin with no further code changes.

To make this contract explicit and prevent drift, add a short header comment to `feature-modules.js`:
> "Single source of truth for tenant-toggleable modules. Add a new entry here and it will automatically appear in Tenant Admin → Modules and be honored by sidebar/route filtering via `disabled_features`."

### Notes
- Purely a data-list update — no schema, RLS, or UI logic changes.
- Existing `disabled_features` guard continues to work; new modules default to enabled for all tenants.
- Sub-feature toggles for SMS/WhatsApp already exist in `useSubFeature.js` (`communications.whatsapp`) and remain untouched.
