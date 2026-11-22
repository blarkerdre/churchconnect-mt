# Show feature parts only when the feature is switched on for a church

Whole pages are already hidden when a feature is switched off. But some buttons, boxes and reminders from those features still show up on other pages. This plan goes through the whole app and hides them, then makes the server refuse the action as well.

## What changes
For every switchable feature, any button, box, card, tab, reminder strip or dashboard tile that belongs to it is hidden when that feature is off for the church. Super admins still see everything. Examples:
- **Phone Call off**: call buttons on members, follow-ups, Home Cell and attendance screens; the call minutes billing box; the "call minutes low" strip; call options in Communications.
- **SMS / WhatsApp off**: "Send text" and WhatsApp buttons and options in follow-ups, events, members, birthdays, reports and Communications; text top-up box; low-texts strip.
- **Bible Trivia, Testimony, Dashboard Slideshow, Certificates, My Family, Children Church, Events, Home Cell, Bible School, Pastoral Care, Transport and others**: dashboard tiles, quick links, "Issue certificate" buttons, links to My Family on check-in pages, Reports Hub cards and guided-tour steps.
- **Plan & Billing off**: all billing boxes and reminder strips.
- **Server-side**: sending a text, WhatsApp message or phone call is refused when that feature is off for the church, even if someone bypasses the screen. Super admins are not blocked.

## Technical details
- Use the existing `useTenantFeatureEnabled(path)` hook everywhere (replace the ad-hoc `disabled_features.includes` checks in AppLayout, TriviaWidget and others). Add a small `<FeatureOn path>` wrapper for inline JSX.
- Sweep: rg for components that belong to each module in `FEATURE_MODULES` and are rendered outside that module's own route (Dashboard, MemberDashboard, WSFLeaderDashboard, Members, Followups detail/message dialogs, Settings, Reports, check-in pages, tours.js, CourseReportTab, IssueCertificateDialog triggers). Gate each one.
- `LowCallBanner` and `CallTopUpCard`: also require `/phone-call`. `SmsTopUpCard`: require `/sms`.
- New `featureDisabled(admin, tenantId, path)` in `_shared/sender-guard.ts`; `send-sms`, `make-call`, `send-whatsapp` (and scheduled/automatic senders) return 403 when it is true, skipping super-admins.
- Add tests for the shared helper (on, off, super-admin exempt). Add an AGENTS.md rule: module UI outside its own page must be gated by `useTenantFeatureEnabled`, and senders must check `featureDisabled`.
