

## Fix: Twilio Webhook Signature Validation Uses Wrong URL

### Root cause

The edge function logs confirm:
```
Invalid Twilio signature — rejecting webhook
Expected URL used for signing: https://edge-runtime.supabase.com/twilio-webhook
```

Twilio signs its callbacks against the **public** URL (`https://qfordhikmtgedfybktjg.supabase.co/functions/v1/twilio-webhook`), but the function reconstructs the URL using `req.headers.get("host")` which returns the **internal** hostname `edge-runtime.supabase.com`. This mismatch causes every signature check to fail, so `sms_log` never updates from "queued".

### Fix

Update `supabase/functions/twilio-webhook/index.ts` to construct the webhook URL using the known public Supabase URL instead of relying on the `host` header:

```typescript
// Replace lines 31-35 with:
const supabaseUrl = Deno.env.get("SUPABASE_URL")!; // e.g. https://qfordhikmtgedfybktjg.supabase.co
const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
```

This guarantees the URL used for HMAC verification matches what Twilio signed against, regardless of internal routing headers.

### Files changed
- `supabase/functions/twilio-webhook/index.ts` — fix URL reconstruction for signature validation
- Redeploy `twilio-webhook`

### Expected result
Twilio status callbacks will pass signature validation and `sms_log` rows will update from "queued" to "delivered"/"failed" in real time.

