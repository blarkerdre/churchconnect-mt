# Follow-up Feature Flowchart

Produce a single Mermaid diagram (`/mnt/documents/Followup_Feature_Flow.mmd`) that captures every branch of the Follow-up module, then surface it via a `lov-artifact` tag. No app code will change.

## Coverage

The chart will include these swim-lanes / clusters:

1. **Entry points**
   - Auto-creation: new member with status `First Timer` / `New Convert` / `Visitor` / `Absentee` → trigger inserts `followups` row.
   - Manual: Admin / Follow-up team clicks **New Follow-up** on `/followups` (gated by `useSubFeature("followups.create")`).
   - From member profile / analytics conversion reports.

2. **Follow-up record lifecycle**
   - Statuses: `Pending → In Progress → Completed`, with `Overdue` branch when `due_date < today`.
   - Priority (Urgent/High/Medium/Low), assigned_to, due_date, notes.
   - `OverdueReminder` banner on page load.

3. **Role gating**
   - `isAdmin` or Follow-up team member (unit_leader_assignments ilike `%follow%` OR `members.church_unit` includes Follow-up) → `canManageFollowups`.
   - Others: read-only / own tasks only.

4. **Detail panel actions** (`FollowupDetailPanel`)
   - Update status/priority/notes/assigned_to (writes to `followups` scoped by tenant).
   - Send message → `FollowupMessageDialog` (Email / SMS / WhatsApp / In-App) → logs to `sms_log` / `followup_scheduled_messages`.
   - Convert to Active → updates `members.membership_status = 'Active'` and marks follow-up Completed.
   - Sign-Post → `SignPostDialog` creates `followup_referrals` row assigned to a Unit Leader or Home Cell (WSF) leader.
   - Delete (admin) → cascades cleanup of `followup_referrals`, `followup_referral_updates`, `followup_scheduled_messages`.

5. **Referral (Sign-Post) sub-flow**
   - Referrer picks `unit_leader` or `home_cell` target → row inserted.
   - Target leader sees it in `SignPostInboxDialog` (statuses: pending → contacted → engaged → joined/declined/closed).
   - Leader logs updates in `ReferralUpdateDialog` → `followup_referral_updates` + `ReferralTimeline`.
   - Terminal statuses feed back into original follow-up notes.

6. **Reporting & export**
   - `FollowupReportDialog` (Generate Report), CSV download, Print, filters (search, status, date range).

7. **Notifications**
   - Assignment / overdue / referral events → in-app bell + optional push/email.

## Diagram style

- Mermaid `flowchart TD` with subgraphs per cluster listed above.
- Decision diamonds for role gate, status transitions, and referral type.
- No custom colors (theme auto-handles light/dark), no emojis.
- Kept under Mermaid's practical node limit (~60 nodes) while still exhaustive.

## Deliverable

- File: `/mnt/documents/Followup_Feature_Flow.mmd`
- Rendered inline via `<lov-artifact ... mime_type="text/vnd.mermaid">`.
- Short chat summary listing the clusters covered.
