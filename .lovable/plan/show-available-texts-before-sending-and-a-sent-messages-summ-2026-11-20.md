# Show available texts before sending, and a sent-messages summary

## What users will see

**1. "Texts available" box above every Send button for SMS**
(Bulk Members, Bulk Non-Members, Individual send, the SMS window)
- Texts left this month (free allowance), plus top-up balance, giving a total.
- "This send needs X texts" = recipients x texts per message (taken from the character counter, so a two-text message counts double).
- Colour verdict:
  - Green: "Enough. Y texts will be left after sending."
  - Amber: "Uses Z top-up texts" or "Z extra texts will be charged at the church price" (when the plan allows extra texts).
  - Red: "Not enough. You are short by N texts." Send button is disabled, with a "Buy more texts" link to Billing.
- Updates live as you type the message or change who receives it.

**2. "Sent messages" summary in Communications**
- New Summary panel with period choice (This month, Last month, Last 7 days).
- Cards: texts sent, delivered, failed, WhatsApp sent, texts used from free allowance vs top-up.
- Short list of recent sends (date, who sent it, recipients, status) with failures showing the reason in plain words.
- Each church only sees its own figures.

## Technical details
- New hook `useSmsAvailability(tenantId)` reusing the `sms-billing` query logic from `SmsTopUpCard` (limit, used this month, credit balance, overage flag, unit price); extracted into a shared module so both use it.
- Pure function `smsSendCoverage({limit, used, credits, allowOverage, recipients, segments})` mirroring `planSmsCoverage` in the server quota, with a vitest file (enough, uses credits, overage, blocked, multi-segment).
- New `SmsAvailabilityBanner` component (semantic tokens) placed next to `SmsCharCounter`; panels pass recipient count and a `blocked` flag to disable Send. Server-side quota check stays the final guard.
- New `MessageSummaryPanel` reading `sms_log` with `.eq("tenant_id", tenantId)`, grouped by channel and status, added as a tab in Communications.
- Invalidate the availability query after each send.
