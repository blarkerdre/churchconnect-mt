# Certificates Report

Add a new admin report that summarises every certificate issued and reissued in the tenant, with filters, totals, an activity timeline, and CSV / print export.

## Where it lives

- New page: `src/pages/CertificatesReport.jsx` at route `/certificates-report` (tenant-prefixed).
- Linked from:
  - **Reports Hub** (`src/pages/Reports.jsx`) — new card "Certificates" (Award icon).
  - **Training Reports** page — small "Certificates Report" button in the header so admins managing training can jump straight in.
- Visible to Admins, Tenant Owners/Admins, and Reports Officer (read-only). Hidden from regular members.

## Data sources (already exist — no schema changes)

- `training_completions` — current state per (member, training_type): cert number, completion date, issuer, file URL.
- `audit_log` — full history with `action IN ('certificate_issued','certificate_reissued')`, including `details.certificate_number`, `details.training_type`, `details.member_id`, actor `user_id`, and `created_at`. This is the source of truth for reissue counts and timestamps (since reissues update the row in place and keep the same cert number).
- `members` — for member names, units, status.

All queries scoped with `.eq("tenant_id", tenantId)` per project rule.

## UI

Header: "Certificates Report" with date range, totals chips, export buttons.

**Filters**
- Date range (issued/reissued between) — defaults to last 90 days.
- Training programme (multi-select, sourced from distinct `training_type` in `training_completions` + active `exam_titles`).
- Issued by (user dropdown, optional).
- Member search (name / cert number).
- Status: All / Issued only / Reissued only / Reissued ≥ 1 time.

**Summary stat cards**
- Total certificates issued (distinct cert numbers in range)
- Total reissues in range
- Members certified (distinct members)
- Top programme (by count)

**Tabs**
1. **By Certificate** — table: Member · Programme · Cert No · Completion Date · First Issued · Last Reissued · Reissue Count · Issued By · Download.
2. **Activity Log** — chronological audit list: timestamp · action badge (Issued / Reissued) · cert no · member · programme · actor.
3. **By Programme** — aggregated table: Programme · Issued · Reissued · Unique Members; with a small bar chart (recharts, already used in project).

**Exports**
- "Export CSV" for the active tab (members + cert details, or activity log).
- `PrintReportButton` reusing the existing component for a print-friendly view of the active tab.

## Technical notes

- Single page component using `@tanstack/react-query` with `tenantId` from `useTenantQuery`.
- Two parallel queries:
  - `training_completions` joined with `members(first_name,last_name,email,unit,status)`.
  - `audit_log` filtered by `action IN ('certificate_issued','certificate_reissued')` and date range.
- Reissue count per cert = count of `certificate_reissued` rows whose `details->>certificate_number` matches; first issued = min `created_at` of `certificate_issued`; last reissued = max of `certificate_reissued`.
- Issuer name resolved via a `profiles` lookup keyed by actor `user_id` (single batched query for the unique set).
- CSV built client-side; no edge function needed.
- Permission guard mirrors Training Reports page (admin/owner/reports officer); redirects others with a toast.

## Files to add / edit

- **Add** `src/pages/CertificatesReport.jsx`
- **Edit** `src/App.jsx` — register the route (tenant-prefixed and standalone) with the same auth guard pattern as `TrainingReports`.
- **Edit** `src/pages/Reports.jsx` — add the "Certificates" module card.
- **Edit** `src/pages/TrainingReports.jsx` — add a header link/button to the new report.

No DB migration, no edge function, no new dependencies.
