
## SMS delivery troubleshooting plan

### What I found
- The SMS send function is successfully creating Twilio message records and logging them in `sms_log` with real `message_sid` values and `status = sent`, `delivery_status = queued`.
- Recent database rows show multiple messages were accepted for numbers like `+4478...`, so the app is reaching Twilio.
- The webhook used for delivery updates is failing signature validation:
  - `twilio-webhook` logs repeatedly show: `Invalid Twilio signature — rejecting webhook`
- That webhook issue explains why delivery status never moves beyond `queued`, but it does **not** by itself explain why the SMS was not received.
- Based on the current code and the advisor note, the most likely delivery-side causes are:
  1. Twilio trial restrictions: recipient number is not verified
  2. `TWILIO_FROM_NUMBER` is not an SMS-capable Twilio sender or not in valid E.164 format
  3. Less likely: country/carrier restrictions on the Twilio account

### Implementation plan
1. **Fix delivery status tracking**
   - Update `supabase/functions/twilio-webhook/index.ts` so Twilio signature validation uses the exact request URL/protocol seen by Twilio instead of reconstructing it from `SUPABASE_URL`.
   - This will allow delivery callbacks to update `sms_log` from `queued` to `delivered`, `undelivered`, or `failed` with actual error messages.

2. **Improve SMS failure visibility**
   - Update the SMS logs/history UI to surface `delivery_status` and `error_message` more clearly, so delivery failures are visible without checking backend logs.
   - This is important because the send function currently only reflects “accepted by Twilio,” not final handset delivery.

3. **Harden sender validation**
   - Add validation in `send-sms` for the configured sender number before sending:
     - ensure `TWILIO_FROM_NUMBER` is in E.164
     - optionally fail early with a clear error if it looks invalid
   - Keep tenant-specific overrides, but validate those too.

4. **Handle trial-account guidance in-app**
   - If SMS remain undelivered after webhook fix, the next likely non-code blocker is a Twilio trial account.
   - I’ll add clearer error/help messaging for cases where Twilio accepts the request but delivery later fails due to:
     - unverified recipient on trial account
     - unsupported sender
     - carrier rejection

### Expected result
- You’ll be able to see whether messages are truly delivered or failing after Twilio accepts them.
- If the number is unverified or the sender is invalid, the app will show that clearly instead of leaving messages stuck at `queued`.
- If needed, the remaining action will likely be operational: use a Twilio-verified recipient on trial, or switch to a valid SMS-capable Twilio number.
