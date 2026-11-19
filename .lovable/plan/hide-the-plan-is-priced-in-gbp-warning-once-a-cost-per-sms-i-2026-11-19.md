# Hide the "plan is priced in GBP" warning once a Cost per SMS is set

## Problem
In Tenant Admin, after the billing currency is changed to USD and a Cost per SMS is saved, the red note "The plan is priced in GBP. Set a Cost per SMS in USD..." still shows. The note should only show while no Cost per SMS has been entered for the church.

## Change
- Show the red note only when the plan currency differs from the church's currency AND no Cost per SMS is saved.
- When a Cost per SMS is saved, show a short neutral note instead: "Using this church's own price in USD (the plan's GBP price is ignored)."
- Same rule for the note on the church's own Billing page text card.

## Technical details
- `src/components/billing/SmsPricingAdmin.jsx`: condition becomes `!data.planMatches && !hasOverride`, where `hasOverride` = `sms_unit_price_override` not null.
- `src/components/billing/SmsTopUpCard.jsx`: apply the same check to its mismatch note.
- No database or pricing logic changes.
