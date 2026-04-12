

## Multi-Provider SMS & Phone Call System

### Summary
Add a tenant-configurable SMS/Voice provider system supporting Twilio (existing) and Africa's Talking, Termii, and other providers. Add "Phone Call" as a follow-up action with click-to-call and call logging. Tenants choose and configure their preferred provider in Settings > Comms.

### Technical Details

**Provider Architecture**:
- Store provider config in `tenants.settings` JSONB: `sms_provider` (default: "twilio"), `voice_provider`, plus provider-specific credentials stored as secrets per tenant in `app_settings`
- Create a provider abstraction in the edge function that routes SMS/Voice calls to the correct API based on tenant config

### Database Changes

**Migration**: Add `call_log` table for tracking phone calls:
```sql
CREATE TABLE public.call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  caller_id uuid REFERENCES auth.users(id),
  member_id uuid REFERENCES public.members(id),
  recipient_phone text NOT NULL,
  call_type text DEFAULT 'outbound',
  duration_seconds integer,
  status text DEFAULT 'initiated',
  provider text DEFAULT 'twilio',
  provider_call_id text,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_log ENABLE ROW LEVEL SECURITY;
-- RLS: admins/leaders can view tenant calls, members can view own
```

### Edge Function Changes

**1. New: `supabase/functions/make-call/index.ts`**
- Initiates outbound voice call via configured provider (Twilio Calls API or Africa's Talking)
- Logs call to `call_log` table
- Supports provider routing based on tenant settings

**2. Update: `supabase/functions/send-sms/index.ts`**
- Add provider abstraction layer
- Read `sms_provider` from tenant settings
- Route to Twilio gateway (existing) or Africa's Talking / Termii based on config
- Africa's Talking: direct HTTPS POST to `https://api.africastalking.com/version1/messaging`
- Termii: direct HTTPS POST to `https://api.ng.termii.com/api/sms/send`

**3. Update: `supabase/functions/process-scheduled-followups/index.ts`**
- Add same provider routing for scheduled SMS

### Settings UI Changes

**Update: `src/pages/Settings.jsx` — CommunicationsSection**
- Add "SMS Provider" dropdown: Twilio (default), Africa's Talking, Termii
- Add "Voice Call Provider" dropdown: Twilio (default), Africa's Talking
- Conditionally show provider-specific config fields:
  - **Twilio**: SMS From Number, WhatsApp From Number (existing)
  - **Africa's Talking**: API Key, Username, Short Code/Sender ID fields (stored in `app_settings` with keys like `africastalking_api_key`, `africastalking_username`, `africastalking_sender_id`)
  - **Termii**: API Key, Sender ID (stored in `app_settings`)
- Save provider choice to `tenants.settings.sms_provider` / `tenants.settings.voice_provider`

### Follow-up Phone Call Integration

**Update: `src/components/followups/FollowupDetailPanel.jsx`**
- Add "Make Call" button alongside Send Email / Send SMS buttons
- On click: opens a small dialog to confirm call initiation, invokes `make-call` edge function
- Shows call history from `call_log` in the messages section

**Update: `src/components/followups/FollowupMessageDialog.jsx`**
- Add "phone" as a channel option (alongside email/sms)
- When phone selected, show simplified UI (no message body, just confirm call)

### Files Changed
- **Migration**: New `call_log` table with RLS
- **New**: `supabase/functions/make-call/index.ts`
- **Edit**: `supabase/functions/send-sms/index.ts` — multi-provider routing
- **Edit**: `supabase/functions/process-scheduled-followups/index.ts` — multi-provider routing
- **Edit**: `src/pages/Settings.jsx` — provider selection + provider-specific config
- **Edit**: `src/components/followups/FollowupDetailPanel.jsx` — add Make Call button + call history
- **Edit**: `src/components/followups/FollowupMessageDialog.jsx` — add phone call channel
- **Edit**: `supabase/config.toml` — add make-call function config

