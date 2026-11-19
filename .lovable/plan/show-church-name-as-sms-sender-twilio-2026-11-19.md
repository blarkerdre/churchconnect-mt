# Show church name as SMS sender (Twilio)

## What changes
- Settings -> Messaging -> Twilio gets a **Sender Name** box (max 11 letters/numbers, at least one letter, e.g. "RCCGToronto"). Defaults to a cleaned short version of the church name.
- When filled in, texts show that name instead of the phone number, in countries that allow it (UK, most of Europe, Nigeria, Ghana, etc.).
- Texts to Canada/US (+1) keep using the phone number, because those countries block sender names. Recipients there will still see a number.
- If Twilio rejects the name for a country, the app retries once from the phone number so the text still arrives.
- Note: replies are not possible to a sender name.

## What you need to do
- In Twilio, Alphanumeric Sender ID must be enabled on the account (Messaging -> Settings). Some countries need the name pre-registered.

## Technical details
- Store `twilio_sender_name` in tenant provider settings; validate `^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$`.
- Update the shared Twilio sender helper (used by send-sms and the nine notification functions plus scheduled follow-ups) to pick: +1 -> Canada/US number; else sender name if set; else UK number. Fallback to number on Twilio error 21212/21612/21408.
- Add a unit test for the sender-selection rule. Redeploy affected functions.
