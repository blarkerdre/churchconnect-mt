# Make card subscriptions work reliably

## What I found
- Card subscription payments have the same problem the text top-ups had. Stripe has no address set up to tell the app when a payment happens, so nothing it sends is ever received.
- No church has paid a subscription by card yet. All three churches are on manual payment, and none has a card subscription linked. So no church has been affected so far.
- If a church paid by card today, it would be charged, but the app would not:
  - link the subscription to the church
  - record the payment or send a receipt
  - mark the church as active
  - mark the setup fee as paid
- Monthly renewals, failed payments and cancellations would also go unseen. For example, a church whose card fails would stay "active", and a church that cancels would keep access.

## What I will build
1. **Instant check after paying.** When someone comes back from Stripe after paying for a subscription, the app checks with Stripe straight away. It then links the subscription, records the payment, marks the setup fee paid, makes the church active and sends the receipt. This works even with no message from Stripe.
2. **Regular catch-up check.** Once a day, the app asks Stripe about each church with a card subscription. It records any new paid renewals, marks failed payments as overdue and alerts admins, and marks cancelled subscriptions. Doing this daily means renewals still get recorded if Stripe's messages go missing.
3. **Stripe messages set up (recommended).** I will register the app's address in your Stripe account so payments show up within seconds. This needs one secret code from Stripe, and I will ask you for it with a secure form. Until then, steps 1 and 2 keep everything correct.
4. **No double counting.** Each Stripe payment is recorded only once, whichever of the three routes sees it first.

## Technical details
- New shared module `_shared/stripe-sync.ts` holding the existing webhook logic (link subscription, record invoice, past_due, deleted). Both the webhook and the new functions call it.
- New edge function `verify-tenant-subscription` (signed-in owner/admin of the tenant). It reads the subscription's latest `checkout.session` and paid invoices from Stripe and applies them. `Settings.jsx` calls it on `?payment=success` and when the billing card loads.
- New edge function `sync-stripe-subscriptions`, run daily by an internal cron job. It loops over `tenant_subscriptions` that have a `stripe_customer_id`.
- Dedupe: the code skips the insert if a `tenant_payments` row already has `reference = invoice.id`, and a unique partial index on `tenant_payments(reference) WHERE payment_method='Stripe'` backs this up.
- Webhook: create an endpoint for `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed` and `customer.subscription.deleted`, then store `STRIPE_WEBHOOK_SECRET` with add_secret. The text top-up webhook path also starts working once this is in place.
- Test with Stripe test-mode data where possible. I won't charge a live card.
