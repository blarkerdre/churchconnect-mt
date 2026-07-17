## Goal
Children's Church and Teens Church notifications should be delivered **in-app only**. Remove SMS delivery entirely.

## Findings
- **Teens Church** (guardian check-in/out alerts) is handled by `supabase/functions/send-push/index.ts`. It already only writes an in-app `notifications` row plus a web-push message — no SMS. No change needed here.
- **Children's Church pickup PIN** is handled by `supabase/functions/send-pickup-pin/index.ts`. It currently fans out over three channels: in-app notifications, email, **and** SMS via `send-sms`.

## Change
In `supabase/functions/send-pickup-pin/index.ts`:
1. Remove the SMS block (lines ~218–245) that calls `send-sms` for each recipient's phone.
2. Remove the `smsed` counter and drop it from the JSON response.
3. Leave the in-app `notifications` insert untouched.

## Question on email
The user said "Only in-app… No SMS." Email is currently also sent by this function. Two interpretations:
- **A. Strict in-app only** — also remove the email block, so pickup PIN goes only to the in-app notification bell / push.
- **B. Literal reading** — keep email as a fallback; only SMS is removed.

I'll go with **A (in-app only)** unless you say otherwise, since it matches the phrasing "only in-app notification". If you want email kept, tell me and I'll skip the email removal.

## Out of scope
No DB migrations, no UI changes, no changes to teens flow (already in-app + push only).
