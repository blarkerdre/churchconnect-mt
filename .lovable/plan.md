

## Fix: SMS Stuck on "Queued" — Webhook Signature Mismatch

### Problem

SMS is sent via the Lovable connector gateway, which uses its own Twilio account internally. When Twilio sends delivery status callbacks (delivered, failed, etc.) to your `twilio-webhook`, the signature is signed with the gateway's auth token — not your `TWILIO_AUTH_TOKEN`. The webhook rejects all callbacks with 403, so `sms_log.delivery_status` stays "queued" forever.

### Solution

Since the connector gateway proxies through its own Twilio account, the StatusCallback signatures will never match your local auth token. Two changes are needed:

#### 1. `supabase/functions/twilio-webhook/index.ts` — Relax signature validation for gateway-sent messages

Replace the strict HMAC-SHA1 signature check with a dual approach:
- **If `TWILIO_AUTH_TOKEN` matches** → validate normally (for direct Twilio usage)
- **If signature doesn't match** → check for a secondary validation: verify the request contains a valid `MessageSid` and `MessageStatus`, and that the `MessageSid` exists in `sms_log` (proof it's a legitimate callback for a message we sent)

This prevents random abuse while allowing gateway-proxied callbacks through.

```typescript
// After signature validation fails:
// Fallback: verify MessageSid exists in our sms_log (proves we sent it)
if (twilioSignature !== expectedSignature) {
  console.log("Signature mismatch — trying fallback MessageSid verification");
  
  if (!messageSid || !messageStatus) {
    return new Response("Forbidden", { status: 403 });
  }
  
  const { data: existingLog } = await supabase
    .from("sms_log")
    .select("id")
    .eq("message_sid", messageSid)
    .maybeSingle();
  
  if (!existingLog) {
    console.warn("MessageSid not found in sms_log — rejecting");
    return new Response("Forbidden", { status: 403 });
  }
  
  console.log("Fallback validation passed — MessageSid exists in sms_log");
}
```

#### 2. Restructure the webhook to create the Supabase client and extract params before signature validation

Move `messageSid`/`messageStatus` extraction and Supabase client creation above the signature check so the fallback verification can query `sms_log`.

### Files changed
- `supabase/functions/twilio-webhook/index.ts`

