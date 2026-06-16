## Goal
Ensure every Inventory and Settings (`app_settings`) read/write is strictly tenant-isolated, matching the Multi-Tenancy Security Guards rule (explicit `.eq("tenant_id", tenantId)` on all queries and updates).

## Findings from audit

**Schema — already correct, no migration needed:**
- `app_settings`, `inventory_categories`, `inventory_items`, `inventory_checklists`, `inventory_inspections`, `inventory_inspection_responses` all have `tenant_id NOT NULL` with FK to `tenants`.
- Unique constraints are tenant-scoped: `app_settings(key, tenant_id)`, `inventory_categories(tenant_id, name)`.
- RLS policies on all six tables already gate on `tenant_id` via `is_inventory_manager(auth.uid(), tenant_id)` / `is_admin(...)` / `user_has_tenant_access(tenant_id)`.

**Code — mostly tenant-scoped already (Inventory.jsx, InventoryItemDialog, InspectionDialog, InspectionHistoryDialog, useAppSetting, useConsentText, ConsentPrivacySection, ExternalLinksSection, ServiceRosterDialog, useAltarMinistry, PastoralCare, ExamManagement, Settings.jsx, IssueCertificateDialog).**

Gaps to fix:

1. `src/components/settings/DashboardBannerSettings.jsx` — the `update` branch (lines 41-45) targets only `.eq("id", existing.id)` with no `tenant_id` guard. Refactor the whole save to a single `upsert(withTenant({...}), { onConflict: "key,tenant_id" })`, matching the pattern used elsewhere.

2. `src/components/dashboard/DashboardBanner.jsx` and `src/hooks/useAppSetting.jsx` — currently fall back to a global row when `tenantId` is falsy (`if (tenantId) q = q.eq(...)`). Inside an authenticated tenant route this is moot (RLS blocks it), but tighten the read so it returns `fallback`/empty when `tenantId` is unknown instead of issuing a non-scoped query. Set `enabled: !!tenantId` on the React Query and require `tenantId` before issuing the request.

3. Sweep verification: re-run `rg "from\\(\"(app_settings|inventory_)" src` after edits and confirm every `.update`/`.delete` includes `.eq("tenant_id", tenantId)` and every `.insert`/`.upsert` goes through `withTenant(...)`.

## Out of scope
- No DB schema changes (column already exists everywhere).
- No RLS policy changes (already correct).
- No UI/visual changes.
- No changes to other modules (only Inventory + app_settings code paths).

## Files to edit
- `src/components/settings/DashboardBannerSettings.jsx` — switch to tenant-scoped upsert.
- `src/components/dashboard/DashboardBanner.jsx` — gate query on `!!tenantId`.
- `src/hooks/useAppSetting.jsx` — gate query on `!!tenantId`, drop the "global fallback" branch.

## Verification
- Manual: confirm Inventory page loads only this tenant's categories/items, banner slideshow saves once and reloads per tenant, and settings list sections (training types, service types, etc.) remain tenant-isolated.
- Code grep: no remaining `app_settings`/`inventory_*` mutation without an explicit `tenant_id` guard.
