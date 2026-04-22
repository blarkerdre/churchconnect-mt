

## Member Milestone Reports + Targeted Messaging (Admin)

### What you'll get

A new **"Member Milestones"** report tab inside Analytics → Reports (admin-only), with two sub-reports and a built-in "Message These Members" action that sends Email / SMS / WhatsApp / In-App notification to whoever is currently filtered on screen.

```text
Analytics ▸ Reports
 ├─ Training Gap Report                 (already exists)
 ├─ Member Milestones Report            ← NEW
 │   ├─ Filters: status, unit, milestones (BFC, BCC, LCC, LDC,
 │   │           Water Bap, HS Bap, Home Cell, WoFBI), date range,
 │   │           gender, missing/completed toggle
 │   ├─ Member list with milestone badges
 │   ├─ Export CSV  ·  Print Report
 │   └─ [Message Filtered Members] →  Email | SMS | WhatsApp | In-App
 └─ Status Conversion Report            ← NEW
     ├─ "From → To" filter (e.g. First Timer → Member,
     │   New Convert → Member, Visitor → Member, any → any)
     ├─ Date-range filter on the change date
     ├─ Table: Name · Previous · New · Changed On · Days to convert · Changed by
     ├─ Summary cards: # converted, avg days to convert, conversion rate
     ├─ Export CSV  ·  Print Report
     └─ [Message Filtered Members]
```

Both reports live behind an `isAdmin` guard (admins/owners and super admins only). Existing `useSubFeature` toggle `analytics.download_report` keeps controlling export visibility.

### Status Conversion Report — data source

Already in place: every status change writes a row to `member_status_history` (member_id, previous_status, new_status, changed_at, changed_by, tenant_id). We query that table joined to `members` for the names/contact details, scoped by `tenant_id`. No schema changes required.

A status counts as a "conversion to member" when `previous_status ∈ {First Timer, New Convert, Visitor}` and `new_status = Active`. Filter chips let admins also pick custom from→to combinations.

### Targeted messaging from a report

A single **MessageFilteredMembersDialog** that the user opens from either report. It receives the currently-filtered member list (id + name + email + phone + user_id) and exposes one tab per channel:

| Channel | Backend used (already exists) | Notes |
|---|---|---|
| Email   | `send-email-alert` edge function | Subject + body, supports `{first_name}` token |
| SMS     | `send-sms` edge function (existing SMSDialog flow) | Honours per-tenant SMS toggle / quota |
| WhatsApp| same `send-sms` function with channel=`whatsapp` | Honours WhatsApp tenant toggle |
| In-App  | direct insert into `notifications` (only for members with linked `user_id`) | Title + message, optional link to `/members/:id` |

The dialog reuses the existing recipient-validation UI (`InvalidRecipientsPreview`) so admins can see who lacks email/phone/account before sending. Tokens supported: `{first_name}`, `{last_name}`, `{church_unit}`, `{previous_status}`, `{new_status}` (last two only on the Conversion report).

A confirmation step shows: "Sending to X members via [channel]" before dispatch, and writes an audit_log entry `entity_type=bulk_message`, `action=sent`, `details={ source: 'milestone_report' | 'conversion_report', channel, recipient_count, filters }`.

### CSV / Print output

CSV columns for milestones report: `First Name, Last Name, Email, Phone, Status, Church Unit, Gender, BFC, BCC, LCC, LDC, Water Baptism, HS Baptism, Home Cell, WoFBI Level, Joined`.

CSV columns for conversion report: `First Name, Last Name, Email, Phone, Previous Status, New Status, Changed On, Days Since Joining, Changed By`.

Print uses the existing `PrintReportButton` for branded layout.

### Files to add

- `src/components/analytics/MemberMilestoneReport.jsx` — filters + table + CSV/print + "Message" button
- `src/components/analytics/StatusConversionReport.jsx` — joins `member_status_history` with `members`, filters, summary cards, CSV/print + "Message" button
- `src/components/analytics/MessageFilteredMembersDialog.jsx` — 4-tab channel picker; calls `send-email-alert`, `send-sms`, or inserts into `notifications`

### Files to edit

- `src/pages/Analytics.jsx` — under the existing `<TabsContent value="reports">`, add the two new reports below `<TrainingGapReport>`; both wrapped in `{isAdmin && (...)}`.
- `src/hooks/useSubFeature.js` — add two sub-features under `/analytics`: `analytics.milestone_report` and `analytics.conversion_report` so super admins can toggle them per tenant.

### Security / scoping

- All queries pass through `useTenantQuery().scopeQuery` so reports only show the current tenant's members and history rows.
- Report tabs are gated on `useAuth().isAdmin`.
- In-app notifications inserted only for members whose `user_id` is non-null and whose tenant matches.
- Existing RLS on `notifications`, `member_status_history`, `email_send_log`, and `sms_log` already enforces tenant scoping — no migrations needed.

### Verification

1. As tenant admin → Analytics → Reports → Member Milestones, filter "Missing BFC" + Active members → list shows only those, CSV downloads, Print opens branded preview.
2. Click **Message Filtered Members → Email**, send subject "BFC reminder" with body using `{first_name}` → recipients receive email; `email_send_log` rows appear.
3. Switch to In-App → confirm only members with linked accounts get notifications and the bell badge updates for them in real time.
4. Open Status Conversion Report, filter "First Timer → Active" in the last 90 days → table shows the right people (cross-check with `member_status_history`); summary cards show count, avg days, conversion rate.
5. As a non-admin (regular member or unit leader) → both new report tabs are hidden.
6. Switch tenants → reports recompute against the new tenant only; messaging only targets that tenant.

