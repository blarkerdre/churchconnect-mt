## Goal

Extend the existing training workflow so attendees can be searched and added **inside the "Record Training Session" dialog** (not only via the post-creation expandable panel), and give the Training Rep Unit leader a dedicated **report view** for certificate approvals.

The rest of the workflow (signpost → approve/decline → issue certificate) already exists from the previous implementation and is reused unchanged.

## Changes

### 1. Record Training Session dialog (`src/pages/TrainingReports.jsx`)

Add a new **Attendees** section to the create form, visible only to Training Rep members / admins:

- Search input that filters tenant `members` by name/email (debounced, capped at 200 results).
- Checkbox list of matching members; selected rows show inline in a chip strip with a remove (×) button.
- Per-row **Completed** toggle (defaults to true). When unchecked, an optional **Reason** input appears.
- Empty list is allowed (existing behaviour preserved — you can save a session with no attendees and add them later).

On submit:

- Insert the `training_reports` row as today.
- Then insert one `training_attendees` row per selected member (`training_report_id` = new id, `training_type`, `attended: true`, `completed`, `not_completed_reason`, `signpost_status: 'none'`).
- Both inserts happen in the same mutation; failure of the attendee insert surfaces a toast but the session row is kept (already saved).

No DB / RLS changes — the `training_attendees` table, policies, and triggers from the prior migration cover this.

### 2. Signpost from inside the dialog (optional convenience)

In the same Attendees section, completed rows get a **Signpost** checkbox. If ticked at save time, the attendee insert sets `signpost_status: 'pending'`, `signposted_by`, `signposted_at`, triggering the existing notification flow to Training Rep Unit leaders.

### 3. Leader report (`src/pages/CertificateApprovals.jsx`)

Add a **Report** tab alongside the existing Pending / Approved / Declined / Issued / All tabs. The report tab shows:

- Filters: status (multi), training type, date range (signposted_at), decision-maker.
- Summary cards: total signposted, pending, approved, declined, issued, average days to decision.
- Grouped table by Training Type with per-group counts.
- Reuse existing CSV export + `PrintReportButton`.

Visible only to Training Rep Unit leaders and admins (existing route guard already enforces this).

### 4. `TrainingAttendeesPanel.jsx`

No functional change — remains the post-creation editor for sessions already saved. Stays in sync with the new in-form path because both write to `training_attendees`.

## Out of scope

- No new tables, RLS, or edge functions (all already in place).
- No changes to `issue-certificate` or notification function.
- No bulk CSV import of attendees.
- No new app role — unit-membership check continues to gate access.

## Files

**Edited**
- `src/pages/TrainingReports.jsx` — extend create dialog with attendee search/select + save-time inserts.
- `src/pages/CertificateApprovals.jsx` — add Report tab with filters, summary, grouped table, CSV/Print.
