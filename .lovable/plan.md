

## Add Membership Status Audiences to Email, SMS & WhatsApp

### What changes
Add 5 new status-based audience options — **All Members**, **Active Members**, **First Timers**, **Inactive Members**, **New Converts** — to all communication channels (Email, SMS, WhatsApp). These filter by `membership_status` instead of `church_unit`.

### Audience categories

Currently audiences are unit-based (Choir, Ushering, etc.) filtering via `church_unit`. The new audiences filter by `membership_status`:

| Audience Label | Filter |
|---|---|
| All Members | No status filter (existing) |
| Active Members | `membership_status = 'Active'` |
| First Timers | `membership_status = 'First Timer'` |
| Inactive Members | `membership_status = 'Inactive'` |
| New Converts | `membership_status = 'New Convert'` |

These will appear as a separate "By Status" group in the audience dropdown, visually separated from unit-based audiences.

### Files to change

1. **`src/pages/Communications.jsx`** (~lines 29, 75-80)
   - Add status-based audiences to the `AUDIENCES` array with a prefix convention (e.g., `status:Active`, `status:First Timer`) to distinguish from unit-based
   - Display them with friendly labels in the dropdown, grouped under a separator

2. **`src/components/comms/EmailAlertForm.jsx`** (lines 12-17)
   - Remove the hardcoded `AUDIENCES` array; accept audiences as a prop from Communications page
   - Or add the status audiences inline

3. **`src/components/sms/SMSDialog.jsx`** (lines 22-27)
   - Add status-based audiences to the `AUDIENCES` array
   - Update the member query (line 70) to handle status-based filtering: when audience starts with `status:`, filter by `membership_status` instead of `church_unit`

4. **`supabase/functions/send-email-alert/index.ts`** (lines 142-144)
   - Add logic to detect status-based audiences and filter by `membership_status` instead of `church_unit`
   - Redeploy function

5. **`src/components/followups/FollowupMessageDialog.jsx`**
   - No changes needed (sends to individual recipients, not audiences)

### Implementation detail

**Audience value convention:** Use a `status:` prefix to distinguish status audiences from unit audiences:
- `status:Active` → filter `membership_status = 'Active'`
- `status:First Timer` → filter `membership_status = 'First Timer'`
- `status:Inactive` → filter `membership_status = 'Inactive'`  
- `status:New Convert` → filter `membership_status = 'New Convert'`

**Frontend:** Group audiences in the Select dropdown with labels — "By Status" and "By Unit" — using disabled separator items.

**Backend (`send-email-alert`):** Before the existing `church_unit` filter, check if audience starts with `status:` and apply `.eq('membership_status', statusValue)` instead.

**SMS Dialog:** Same pattern — the member query already filters by `church_unit`; add a branch for `status:` audiences to filter by `membership_status`.

### Files changed
- `src/pages/Communications.jsx`
- `src/components/comms/EmailAlertForm.jsx`
- `src/components/sms/SMSDialog.jsx`
- `supabase/functions/send-email-alert/index.ts`

