

## Custom SMS & Voice Provider Integration

### Summary
Replace the hardcoded provider dropdowns with a flexible system where tenants can configure **any** SMS or voice call provider by supplying a custom API endpoint URL, authentication headers, and request body template. Keep the existing pre-built providers (Twilio, Africa's Talking, Termii) as ready-made presets, but add a "Custom" option that lets tenants integrate any provider with an HTTP API.

### How It Works for Tenants
1. In Settings > Communications, the SMS/Voice provider dropdown gains a new **"Custom"** option
2. When "Custom" is selected, a configuration form appears with:
   - **Provider Name** (e.g. "BulkSMS", "Vonage", "SMSLive247")
   - **API Endpoint URL** (the provider's send SMS/call endpoint)
   - **HTTP Method** (POST/GET)
   - **Auth Header Name** and **Auth Header Value** (e.g. `Authorization: Bearer xxx` or `apiKey: xxx`)
   - **Request Content Type** (JSON or form-encoded)
   - **Request Body Template** — a JSON template with placeholders `{{to}}`, `{{message}}`, `{{from}}` that get replaced at send time
   - **Sender ID / From Number**
3. Pre-built providers (Twilio, Africa's Talking, Termii) continue to work as before with their dedicated fields

### Technical Details

**Settings UI** (`src/pages/Settings.jsx`):
- Add "custom" as an option in both SMS and Voice provider selects
- When custom is selected, render the custom provider config form
- Store custom config in `app_settings` with keys like `custom_sms_provider_config` and `custom_voice_provider_config` (JSON value containing endpoint, headers, body template, etc.)

**Edge Function** (`supabase/functions/send-sms/index.ts`):
- Add a `custom` provider branch
- Read the custom config from `app_settings`
- Build the HTTP request from the template, replacing `{{to}}` and `{{message}}` placeholders
- Apply the configured auth header
- Send the request and parse the response

**Edge Function** (`supabase/functions/make-call/index.ts`):
- Same pattern — add `custom` provider branch for voice calls
- Read custom voice config, build request from template with `{{to}}` placeholder

**Edge Function** (`supabase/functions/process-scheduled-followups/index.ts`):
- Add same custom provider routing in the `sendSms` function

### Files Changed
- **Edit**: `src/pages/Settings.jsx` — add "Custom" option + dynamic config form for custom SMS/Voice providers
- **Edit**: `supabase/functions/send-sms/index.ts` — add custom provider routing
- **Edit**: `supabase/functions/make-call/index.ts` — add custom provider routing
- **Edit**: `supabase/functions/process-scheduled-followups/index.ts` — add custom provider routing in sendSms

