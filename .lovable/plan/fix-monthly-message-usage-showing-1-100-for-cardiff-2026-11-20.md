# Fix "Monthly Message Usage" showing 1/100 for Cardiff

## What's wrong
Cardiff has sent 75 texts this month: 73 delivered, 1 sent, 1 failed. The usage counter only counts texts still marked "sent". When the phone company confirms a text arrived, its status changes to "delivered", and the counter stops counting it. That is why it shows 1/100 when it should show 74/100.

The check that stops sending once the allowance runs out already counts correctly (everything except failed texts). Only the number shown on the Settings page is wrong.

## Fix
- Change the monthly usage count so it includes every text and WhatsApp message except failed ones, the same rule the allowance check uses.
- Cardiff will then show 74/100 for SMS. WhatsApp usage gets the same fix.
- Add a small test that checks delivered texts are counted and failed texts are not.

## Technical details
- New migration that replaces `public.get_tenant_message_usage`: change `l.status = 'sent'` to `l.status <> 'failed'` for both channels. Keep the existing access check and SECURITY DEFINER.
- No front-end change is needed. Settings.jsx already shows `msgUsage.sms / sms_limit_monthly`.
