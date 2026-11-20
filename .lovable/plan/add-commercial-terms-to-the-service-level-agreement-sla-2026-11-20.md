# Add commercial terms to the Service Level Agreement (SLA)

## What changes
The church's SLA (Settings → SLA, and its PDF) will automatically fill in, from that church's own records:
- **Monthly subscription**: amount, currency and billing cycle (from the church's subscription).
- **One-off setup cost**: the agreed setup fee and whether it has been paid.
- **SMS cost**: the church's Cost per SMS (its own override, otherwise the plan's price), in the church's billing currency, plus the monthly free SMS allowance.
- **Selected features**: the list of modules switched on for that church (modules turned off are left out).

A new "Commercial Terms" table is added to the default SLA wording. Super admins editing the SLA template will see the new fill-in tags in the tag list and preview, so they can place them anywhere.

## What stays the same
- Already-signed SLAs keep the exact wording and figures they were signed with.
- Figures are read-only in the SLA; they are still set in Tenant Admin (subscription, setup fee, SMS pricing, feature toggles).
- If a figure isn't set, the SLA shows "Not agreed" instead of a blank or 0.

## Technical details
- `src/lib/sla.js`: add tokens `monthly_subscription`, `billing_cycle`, `setup_fee`, `setup_fee_status`, `sms_unit_price`, `sms_monthly_allowance`, `selected_features` (HTML list, escaped via escHtml); add a Commercial Terms section to `DEFAULT_SLA_BODY`; PDF builder renders list items.
- `SLASection.jsx`: query `tenant_subscriptions` (active, tenant-scoped), `tenants` (`billing_currency`, `sms_unit_price_override`, module toggles) and the linked pricing plan; format with currency symbol.
- `SLATemplateAdmin.jsx`: sample values for the new tokens in preview.
- Optional: offer to add the new section to the currently active template as a new version (existing signatures unaffected).
- Small test for token formatting (override vs plan price, "Not agreed" fallback).
