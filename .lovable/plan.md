

## Add Testimony Sharing Feature

### Summary
Members can share testimonies with three structured fields (Situation, What I Did, What the Lord Has Done). The testimony is emailed to a tenant-configurable email address. Admins set the recipient email in Settings.

### Changes

**1. New component: `src/components/testimony/TestimonyFormDialog.jsx`**
- Dialog with three Textarea fields: "What was the situation?", "What did you do?", "What has the Lord done?"
- Optional member name auto-filled from `myMember`
- On submit, calls the `send-testimony` Edge Function
- Success toast after submission

**2. Add testimony button to Member Dashboard (`src/components/dashboard/MemberDashboard.jsx`)**
- Add a "Share Testimony" card/button between the Self Check-In widget and the Feed section
- Opens the TestimonyFormDialog

**3. New Edge Function: `supabase/functions/send-testimony/index.ts`**
- Accepts: `tenant_id`, `member_name`, `situation`, `action`, `god_did`, `sender_email`
- Reads `testimony_recipient_email` from `app_settings` for the tenant
- Falls back to a default (or returns error if not configured)
- Sends the testimony email using the existing email infrastructure (enqueue via `enqueue_email` RPC)
- Includes CORS headers, input validation

**4. Settings: Add testimony email config (`src/pages/Settings.jsx`)**
- New section (or add to Communications tab) with a single email input: "Testimony Recipient Email"
- Stored in `app_settings` with key `testimony_recipient_email`
- Uses the existing `app_settings` upsert pattern

### No database migrations needed
Uses existing `app_settings` table for the configurable email. The edge function sends email directly — no new tables required.

### Files changed
- **New**: `src/components/testimony/TestimonyFormDialog.jsx`
- **Edit**: `src/components/dashboard/MemberDashboard.jsx` — add testimony button
- **New**: `supabase/functions/send-testimony/index.ts` — sends testimony email
- **Edit**: `src/pages/Settings.jsx` — add testimony email setting
- **Edit**: `supabase/config.toml` — add send-testimony function config

