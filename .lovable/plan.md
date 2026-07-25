## Goal
Make every screen, tab, dialog, form, and table in Tenant Admin fit cleanly at 384px wide (mobile) up through desktop, with no horizontal page scroll and no cramped rows.

## Scope
- `src/pages/TenantAdmin.jsx`
- `src/components/tenants/*.jsx` (all files)

## Fixes to apply

### 1. Main Tenant Admin page (`TenantAdmin.jsx`)
- Wrap outer container with `min-w-0` so children can shrink.
- Make the top `<TabsList>` (Overview / Analytics / Users / Billing / Pricing / Integrations / SLA) horizontally scrollable with `overflow-x-auto whitespace-nowrap` and `TabsTrigger` `whitespace-nowrap`.
- Stat row `grid-cols-2 sm:grid-cols-4` — keep, but ensure each `StatCard` truncates long values.
- Tenants list `CardHeader` (line 462): change `flex-row … flex-wrap` → `flex-col sm:flex-row sm:items-center sm:justify-between gap-2`; make action buttons `flex-1 sm:flex-none`.
- Every `DialogContent` in this file (create-tenant, edit-tenant, restore, archive, delete, tenant-details, sub-dialogs — lines 478, 527, 747, 869, 916, 958, 994, 1225) gets `w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto` appended.
- Tenant-details dialog inner `TabsList` (line 1000) — swap the fixed `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` for a horizontally scrollable list so 5 tabs don't wrap into 3 rows at 384px.
- Any `grid-cols-2` inside dialogs that show side-by-side labeled fields collapse to `grid-cols-1 sm:grid-cols-2`.

### 2. Sub-components
- **`TenantUsersDialog.jsx`**: `DialogContent max-w-2xl` → add mobile width class; keep table `overflow-x-auto` but add `min-w-[640px]` inside so columns don't crush.
- **`PlatformUsersTab.jsx`**: table wrapper — add `min-w-[720px]` to `<Table>`.
- **`PricingTab.jsx`**: `TabsList` (line 504) scrollable; edit dialog (`max-w-3xl`) gets mobile width; opening `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`; each pricing table gets `min-w-[720px]`.
- **`TenantBillingTab.jsx`**: all four `grid-cols-2` blocks → `grid-cols-1 sm:grid-cols-2`.
- **`TenantAnalyticsTab.jsx`**: verify `grid-cols-2 sm:grid-cols-4` metric grids stay; add `min-w-0` and truncation to metric titles.
- **`DomifortIntegrationSection.jsx`**: `TabsList` scrollable; both `DialogContent`s get mobile width + scroll cap; token/webhook code blocks get `break-all`.
- **`SLASection.jsx` + `SLATemplateAdmin.jsx`**: `DialogContent max-w-2xl`/`max-w-md` get mobile width + `max-h-[90vh] overflow-y-auto`.
- **`InvoiceEditorDialog.jsx`**: `DialogContent max-w-5xl` → add mobile width; inner `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`; footer buttons stack on mobile.
- **`InvoicesReceiptsList.jsx`**: wrap list rows so long invoice numbers/amounts wrap; action buttons `flex-wrap`.
- **`PaymentRequiredScreen.jsx` / `PaymentWarningBanner.jsx`**: check CTA rows stack under 400px.

### 3. Shared patterns applied
- Dialog width recipe: `max-w-* w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto`.
- Tab list recipe: `overflow-x-auto whitespace-nowrap` + triggers `whitespace-nowrap` instead of fixed-grid.
- Card headers with actions: `flex-col sm:flex-row sm:items-center sm:justify-between gap-2`.
- Tables in cards: outer `overflow-x-auto -mx-4 sm:mx-0`, inner `<Table className="min-w-[…]">`.
- Multi-column detail grids: `grid-cols-1 sm:grid-cols-2` (or `sm:grid-cols-3`).

## Out of scope
No behavioral, data, RLS, or copy changes — layout/classname edits only.

## Verification
- Read the edited files back to confirm the classes landed.
- Playwright screenshots of `/tenant-admin` at 384px and 1280px: main tabs row, tenants list, tenant-details dialog with each inner tab, PricingTab edit dialog, InvoiceEditorDialog. Confirm no horizontal page scroll and all buttons remain reachable.
