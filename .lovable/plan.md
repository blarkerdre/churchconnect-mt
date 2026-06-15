## Inventory & Health and Safety Inspections

Add a new tenant-scoped Inventory module for Church Administrators (and members of the configurable "Church Office" unit) to manage assets and run health & safety inspections.

### Access
- **Manage (CRUD items, run inspections, configure):** Tenant Admins/Owners + members of the church-office unit.
- The unit name is configurable via `app_settings` key `inventory.church_office_unit` (default `"Church Office"`), set on the Inventory page (admin-only).
- All queries strictly scoped by `tenant_id`.

### Data model (new tables, all tenant-scoped, RLS enabled)
1. **`inventory_items`**
   - `name`, `category`, `location`, `serial_number`, `purchase_date`, `condition` (`good|fair|poor|out_of_service`), `notes`, `photo_url`
   - `requires_inspection` (bool) — flag-only items get H&S features
   - `inspection_frequency_days` (int, nullable) — per-item override
   - `category_id` (nullable FK to `inventory_categories`) — supplies the default frequency
   - `last_inspected_at`, `next_due_at` (maintained by trigger)
   - `created_by`, timestamps

2. **`inventory_categories`** — `name`, `default_frequency_days`, `description`

3. **`inventory_checklists`** — per-item custom checklist
   - `item_id`, `position`, `prompt`, `required` (bool)

4. **`inventory_inspections`**
   - `item_id`, `inspected_by`, `inspected_at`, `overall_result` (`pass|fail|needs_attention`), `notes`, `signature_name`

5. **`inventory_inspection_responses`**
   - `inspection_id`, `checklist_item_id` (snapshot prompt text too), `result` (`pass|fail|n/a`), `comment`

### Frequency logic
- Effective frequency = `inventory_items.inspection_frequency_days` ?? `inventory_categories.default_frequency_days`.
- DB trigger on insert of a new inspection updates `last_inspected_at` and recomputes `next_due_at` = `last_inspected_at + effective_frequency`.
- Items where `requires_inspection = true` and `next_due_at <= now()` are surfaced as "Due / Overdue".

### RLS
- Helper `is_inventory_manager(tenant_id)` = tenant admin/owner OR member of configured church-office unit.
- SELECT/INSERT/UPDATE/DELETE on all five tables gated by `is_inventory_manager(tenant_id)`.
- GRANTs to `authenticated` + `service_role` per project conventions.

### UI (new page `src/pages/Inventory.jsx`, route `/t/:slug/inventory`)
- **Tabs:** Items · Due Inspections · Categories · Settings
- **Items tab:** searchable/filterable table; add/edit dialog (`InventoryItemDialog.jsx`) with the requires-inspection toggle that reveals checklist builder + frequency override.
- **Due tab:** items past or near `next_due_at`, with "Inspect now" button opening `InspectionDialog.jsx` (renders the item's checklist, captures pass/fail/comment per row, overall result + signature + notes).
- **Item detail drawer:** inspection history + checklist editor.
- **Categories tab:** CRUD categories with their default frequency.
- **Settings tab:** select the Church Office unit (writes `app_settings`).
- Sidebar entry "Inventory" (visible to admins + church-office unit members), uses `useAuth`/`useChurchUnits` to gate visibility.
- Styling follows existing Navy/Gold tokens, Playfair headings, Source Sans body. `TenantDialogHeader` on all dialogs.

### Audit & notifications
- Each inspection logged via `logAudit` (`inventory.inspection_completed`).
- In-app notification to inventory managers when an item becomes overdue (cron-friendly query; initial release: surface in Dashboard "Due Inspections" widget — no new edge function required).

### Out of scope
- No financial valuation/depreciation tracking (per project scope constraint).
- No SMS/email reminders in this iteration.
- No bulk import (can be added later).
