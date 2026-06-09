## Goal

Let members of the **Training Rep** unit record per-member attendance against training sessions, mark non-completion, and signpost completers to the **Training Rep Unit leader** for certificate issuance. The Training Rep Unit leader approves/declines and generates a report.

## Roles (no new app role)

- **Training Rep member** — any user whose `members.church_unit` includes "Training Rep" / "Training Reps" / "Training" (case-insensitive, comma-tolerant). Admins also allowed.
- **Training Rep Unit leader** — any user listed in `unit_leader_assignments` for the Training Rep unit. Admins also allowed.

New SECURITY DEFINER helpers (recursion-safe, mirroring `user_is_followup_unit_member`):
- `is_training_rep_member(_user_id, _tenant_id) returns boolean`
- `is_training_rep_leader(_user_id, _tenant_id) returns boolean`

## Data model

New table `public.training_attendees`:

- `id`, `tenant_id`, `training_report_id` (FK → `training_reports`, cascade)
- `member_id` (FK → `members`)
- `training_type` (denormalised for filtering)
- `attended` bool default true
- `completed` bool default false
- `not_completed_reason` text
- `signpost_status` text check (`none|pending|approved|declined|issued`) default `none`
- `signposted_by`, `signposted_at`
- `decision_by`, `decision_at`, `decision_notes`
- `certificate_number` (set on issuance)
- timestamps + unique `(training_report_id, member_id)`

RLS:
- SELECT: tenant members via `user_has_tenant_access`.
- INSERT / UPDATE attendance + signpost fields: Training Rep members or admins.
- UPDATE decision fields: Training Rep Unit leader or admin (BEFORE UPDATE trigger enforces column-scoped permissions and forbids cross-tenant writes).
- DELETE: admins only.

Standard GRANTs, `updated_at` trigger, audit log on status transitions.

## UI changes

1. **`TrainingReports.jsx`** — each session row gains an expandable **Attendees** panel (visible to all; editable only by Training Rep members / admins):
   - "Add Members" searchable multi-select from tenant `members`.
   - Per-row `Completed` toggle; if off, optional `Reason` input.
   - **Signpost for Certificate** button on completed, non-signposted rows → sets status `pending`. Single confirmation dialog (no leader picker — always routed to Training Rep Unit leaders).
   - Status badge after signpost.

2. **New page `src/pages/CertificateApprovals.jsx`** at `/t/:tenantSlug/certificate-approvals`:
   - Tabs: Pending / Approved / Declined / Issued / All.
   - Columns: Member, Training Type, Session Date, Signposted By/At, Status, Actions.
   - **Approve** → calls existing `issue-certificate` edge function, stores returned cert number, sets status `issued`.
   - **Decline** → requires notes, sets status `declined`.
   - CSV export + Print via existing helpers.
   - Visible to Training Rep Unit leaders and admins only.

3. **`AppLayout.jsx`** sidebar — new "Certificate Approvals" entry for Training Rep leaders + admins, with a pending-count badge.

4. **`CertificatesReport.jsx`** — new **Approvals** tab mirroring the inbox with filters (status, training type, date range) and CSV/Print.

5. **Notifications** — DB trigger inserts a `notifications` row for each Training Rep Unit leader on `pending`. New edge function `notify-certificate-signpost` sends best-effort email (mirrors `notify-pastoral-assignment`).

## Edge functions

- **Reuse** `issue-certificate` on approval.
- **New** `supabase/functions/notify-certificate-signpost/index.ts`.

## Files

**New**
- migration `<ts>_training_attendees.sql`
- `supabase/functions/notify-certificate-signpost/index.ts`
- `src/pages/CertificateApprovals.jsx`
- `src/components/training/TrainingAttendeesPanel.jsx`

**Edited**
- `src/pages/TrainingReports.jsx`
- `src/pages/CertificatesReport.jsx`
- `src/App.jsx`
- `src/components/AppLayout.jsx`

## Out of scope

- New `training_rep` app role (unit-membership check is sufficient).
- Bulk CSV import of attendees.
- Changes to certificate template / `issue-certificate` core logic.
- Routing to the member's own unit leader (all approvals go to the Training Rep Unit leader).
