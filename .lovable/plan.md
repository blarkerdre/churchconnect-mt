# Low call-minute alerts (customisable)

## What you'll get
- In **Settings → Billing → Call minutes**, a new "Low minutes alert" box where church owners/admins choose:
  - Alert when minutes left drop to (e.g. 30) — their own number.
  - Who gets it: owners, admins, or extra email addresses (same church only).
  - How: bell alert, email, text (any mix).
  - Their own message wording (plain text, checked like birthday templates), with a built-in fallback.
  - On/off switch.
- "Minutes left" = remaining monthly allowance + top-up balance. Unlimited plans (0 allowance) never alert.
- One alert per drop: it won't repeat until minutes are topped up above the level again, or the new month starts.
- A second, fixed "minutes used up" alert when calls are refused.
- Message includes a link to the Billing page to top up (card or bank transfer).

## Technical details
- Migration: `call_low_alert_settings` jsonb on `tenants` (threshold, channels, recipients, template, enabled) + `call_low_alert_sent_at`; editable by owners/admins (not covered by billing guard), validated by a trigger (threshold 1–10000, template ≤ 300 chars, plain text).
- `call_log_meter_minutes` trigger: after deducting, if remaining ≤ threshold and not already alerted this cycle, call `pg_net` to a new `notify-low-call-minutes` function; reset flag on top-up confirm/card top-up.
- Edge function `notify-low-call-minutes` (service-role only): applies `safeTemplate` checks, `tenantSuspended` refusal, notice-dedupe, sends bell/email/SMS to admins only.
- UI card in `CallTopUpCard.jsx` area with a "Send test to me" button (goes only to the caller).
- Test: alert fires once at threshold, not again until topped up.
