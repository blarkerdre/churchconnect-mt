## Goal
Extend the Bible School Applications tab (`src/components/exams/WoFBIApplicationsTab.jsx`) so admins can filter responses, view a summary report, and delete individual or bulk submissions — alongside the existing search, view, approve/reject, and CSV export.

## Changes

### 1. Filters (above the table)
Add a filter bar next to the existing search input:
- **Status**: All / Submitted / Approved / Rejected (Select)
- **Course**: All courses / each course from `exam_titles` used by applications (Select)
- **Date range**: From / To date inputs (filters on `created_at`)
- **Clear filters** button when any filter is active

Filters compose with the existing text search. Filtered results also drive the CSV export (already the case) and the report summary.

### 2. Report (summary panel)
Add a collapsible "Report" section above the table showing metrics for the **currently filtered** set:
- Total applications
- Counts by status (Submitted / Approved / Rejected) with % of total
- Top 5 courses by application count
- Submissions this month vs. last month
- Button: **Export Report (CSV)** — a small summary CSV distinct from the existing per-row export

Rendered as compact stat cards + a small table for course breakdown. No new charts library.

### 3. Delete
- **Row-level delete**: add a Delete (trash) button in each row's Actions column, with a confirm dialog ("Delete this application? This cannot be undone.").
- **Detail dialog delete**: add a Delete button in the existing detail dialog footer (same confirm).
- **Bulk delete**: add checkboxes per row + header "select all (filtered)" checkbox. When ≥1 selected, show a toolbar with "Delete selected (N)" (confirm dialog).
- All deletes are tenant-scoped: `.eq("tenant_id", tenantId).in("id", ids)` and invalidate the `wofbi-applications` query.
- Audit-log each deletion via `logAudit` (action `wofbi_application.deleted`, target = application id, metadata = applicant name/email/course).
- Permission gate: only tenant admins/owners see delete controls (via `useAuth().isTenantAdmin || isTenantOwner`).

### 4. UX polish
- Preserve current selection when filters change; clear selection after successful delete.
- Toasts on success/failure for single and bulk deletes.
- Empty-state text updates when filters yield no results ("No applications match the current filters").

## Technical details

- File: `src/components/exams/WoFBIApplicationsTab.jsx` (single-file change; may extract a small `ApplicationsReport` subcomponent in the same file to keep it readable).
- State additions: `statusFilter`, `courseFilter`, `dateFrom`, `dateTo`, `selectedIds` (Set), `confirmDelete` ({ ids, label }), `showReport`.
- Derived `filtered` memo extended with the new predicates.
- New mutation `deleteApplications` using `supabase.from("wofbi_applications").delete().in("id", ids).eq("tenant_id", tenantId)`.
- RLS: `wofbi_applications` already has tenant-scoped policies; no migration needed. If delete policy is missing for admins, a follow-up migration will be created — will verify by reading policies before implementing and add a migration only if required.
- No schema changes expected.

## Out of scope
- Charts/graphs beyond simple stat cards.
- Editing application answers (approve/reject stays as-is).
- Public form changes.
