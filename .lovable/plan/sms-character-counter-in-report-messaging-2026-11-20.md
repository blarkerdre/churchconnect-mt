# SMS character counter in report messaging

## What you'll see
When sending a text from a report (Analytics member reports, e.g. Milestone and Conversion reports, "Message these members"), the plain "123 chars" line is replaced by the same counter used in Communications:
- characters used and how many texts it will take
- amber "Nearly 2 texts" warning as you approach the limit
- red warning showing the cost multiplier once it goes over one text
- the "Texts available" banner (free + top-up left, texts needed for these recipients); the Send SMS button is disabled when there aren't enough

The same counter is also added to the follow-up "Send message" dialog when SMS is chosen, which had no counter.

## Technical details
- `src/components/analytics/MessageFilteredMembersDialog.jsx`: replace the `{message.length} chars` line in the SMS tab with `<SmsCharCounter text={message} />` + `<SmsAvailability check={useSmsSendCheck(...)} />` for `summary.phoneList.length` recipients; respect its blocked state on the Send button.
- `src/components/followups/FollowupMessageDialog.jsx`: add `SmsCharCounter` under the Textarea when `channel === "sms"`.
- No database changes.
