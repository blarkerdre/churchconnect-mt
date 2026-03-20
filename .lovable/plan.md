

## Fix: Add missing `unsubscribe_token` to certificate emails

### Problem
Certificate emails fail with `400 missing_parameter` because the transactional email payload is missing the `unsubscribe_token` field, which is required by the email API.

### Solution
Update `supabase/functions/issue-certificate/index.ts` to look up (or create) an unsubscribe token for the recipient email from the `email_unsubscribe_tokens` table before enqueuing the email, and include it in the payload.

### Changes

**`supabase/functions/issue-certificate/index.ts`** — In the email section (around line 234-279):
1. Before building the email payload, query `email_unsubscribe_tokens` for the member's email
2. If no token exists, insert one (generate a UUID)
3. Add `unsubscribe_token` to the email payload

### Technical Detail
```javascript
// Before emailPayload construction:
let unsubToken = null;
const { data: tokenRow } = await supabase
  .from("email_unsubscribe_tokens")
  .select("token")
  .eq("email", member.email)
  .maybeSingle();

if (tokenRow) {
  unsubToken = tokenRow.token;
} else {
  unsubToken = crypto.randomUUID();
  await supabase.from("email_unsubscribe_tokens").insert({
    email: member.email,
    token: unsubToken,
  });
}

// Add to emailPayload:
unsubscribe_token: unsubToken,
```

Then redeploy the `issue-certificate` edge function.

