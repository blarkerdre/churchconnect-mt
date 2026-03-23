

## Plan: Fix WhatsApp FROM Number Formatting

### Problem
The error `The 'From' number whatsapp: +44 7888873207 is not a valid phone number` shows the FROM number has extra spaces. The stored secret likely contains `whatsapp: +44 7888873207` instead of `whatsapp:+447888873207`.

### Root Cause
The edge function reads `TWILIO_WHATSAPP_FROM` as-is without sanitizing whitespace or formatting.

### Fix

**1. Edge function: `supabase/functions/send-sms/index.ts`**
- When reading `TWILIO_WHATSAPP_FROM`, strip all spaces from the value
- Ensure the `whatsapp:` prefix has no space before the `+`
- Add a `.replace(/\s/g, "")` call on the env var value before using it

The relevant code change (around line 75-79):
```typescript
// Before
const waFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");
fromNumber = waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`;

// After  
const waFrom = Deno.env.get("TWILIO_WHATSAPP_FROM")?.replace(/\s/g, "") || "";
fromNumber = waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`;
```

This produces `whatsapp:+447888873207` regardless of how the secret was entered.

**2. Update the secret value**
- Also update `TWILIO_WHATSAPP_FROM` to the clean value `whatsapp:+447888873207` so it's correct at the source

No database or frontend changes needed.

