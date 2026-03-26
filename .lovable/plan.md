

## Plan: Add Tenant Scope Banner to Danger Zone

### Change

Add an alert banner at the top of the Danger Zone card showing which tenant's data will be affected. It will display something like: **"⚠ All actions below will only affect: Demo Church (TEST)"**

### Implementation

**File: `src/components/settings/DangerZoneSection.jsx`**

1. Import `useTenant` from `@/contexts/TenantContext` and `Alert`/`AlertDescription` from `@/components/ui/alert`
2. Get `currentTenant` from `useTenant()`
3. Add an `Alert` banner inside the Danger Zone card, just before the Export section, displaying the tenant name: `currentTenant?.name || "Unknown Tenant"`
4. Style it with a warning/info appearance so it's clearly visible

### No other files or migrations needed

