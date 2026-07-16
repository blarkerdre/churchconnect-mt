## Diagnosis so far

Your logs and DB confirm the app is doing its job correctly:

- Every exam-link and confirmation email has a `pending` → `sent` pair in `email_send_log` (e.g. exam link to `mayodare@gmail.com` at 13:04, course-reg to `blarkerdre@yahoo.com` at 13:27).
- Neither recipient is in `suppressed_emails`.
- Domain `notify.app.churchmanagementsuite.org` is verified, queue is healthy (98 sent in last 7 days).
- `provision-exam-account` returned `emailSent: true` for `mayodare@gmail.com`.

"Sent" means the email provider (Mailgun, via Lovable Emails) accepted the message. The user has already checked spam. That means the message was **dropped or silently filtered downstream of us** — a deliverability problem at the recipient's mail server, not a code bug.

The 92 dead-lettered emails from earlier are a separate historical issue and were **not** retried.

## Most likely causes (in order)

1. **Gmail/Yahoo silently spam-binning or dropping** a new sender subdomain that has no reputation and no DMARC policy yet. This is by far the most common cause of "sent but never received" for Gmail/Yahoo.
2. **Recipient-side rules / forwarding / catch-all filters** discarding before inbox.
3. **Mailgun accepted the message but then bounced/deferred it** after acceptance — not visible in our `email_send_log`, only in Mailgun's own event log.

## Investigation plan (no code changes yet)

**Step 1 — Pull actual delivery events from Mailgun** for the four `message_id`s below and report per-message status (`delivered`, `failed`, `rejected`, `complained`, or missing):

- `b68114a7-…` exam link → mayodare@gmail.com (13:04)
- `9d7621a5-…` course-registration → blarkerdre@yahoo.com (13:27)
- `4b3d01b9-…` welcome-registration → blarkerdre@yahoo.com (13:12)
- `0a961e83-…` course-registration → mayodare@gmail.com (12:43)

This is the authoritative answer to "did it actually leave Mailgun and did the recipient's server accept it?". Done via a read-only Mailgun API call through the connector gateway — no code deployed.

**Step 2 — Interpret events:**

- If Mailgun shows `delivered` → the recipient's mail server accepted it; it's being filtered/hidden on their side (Gmail "All Mail", filters, forwarding). Ask the recipient to search all folders (not just Spam) for the sender domain, and check filters/forwarding rules.
- If Mailgun shows `failed` / `rejected` / `bounced` → we get the exact SMTP reason (e.g. "550 5.7.26 unauthenticated mail is prohibited" → DMARC missing).
- If Mailgun shows no event at all → the send didn't actually reach Mailgun despite our `sent` log row; escalate to Lovable support.

**Step 3 — Deliverability posture check** (regardless of Step 2 result):

- Verify SPF, DKIM, and DMARC records on `notify.app.churchmanagementsuite.org` via a public MX lookup.
- If DMARC is missing (very likely — Lovable delegates SPF/DKIM but DMARC is optional on the root), Gmail is much more likely to silently bin. This is a DNS record on `_dmarc.app.churchmanagementsuite.org` at the root registrar (NOT the delegated subdomain), so the user has to add it.
- Confirm the "From" address (`noreply@notify.app.churchmanagementsuite.org`) aligns with the delegated sender domain — it does, per the current `send-transactional-email` config, so no alignment failure expected.

## Deliverable

A short report per message with:
- Mailgun event status + reason
- Whether the issue is app-side (none expected), sender-config-side (DMARC / warmup), or recipient-side (filters/forwarding).
- Concrete next action (add DMARC TXT record, ask recipient to whitelist, or resend).

## Not in scope for this plan

- Editing any Edge Function or template (the app is working correctly).
- Re-triggering the 92 historical DLQ emails (separate task if you want it).
- Switching email providers.

Approve to run Step 1 (the Mailgun event lookup) and I'll follow through with the report and next steps.
