## Why emails show "sent" but never arrive at Yahoo

`status = sent` in `email_send_log` means Mailgun (via Lovable Emails) **accepted** the message — not that Yahoo delivered it to the inbox. Every recent send in the log targets a single `@yahoo.com` address, the recipient is not in `suppressed_emails`, and the queue is healthy.

The most likely cause is a **DMARC alignment mismatch**:

- Messages are DKIM-signed and SPF-authenticated on `notify.app.churchmanagementsuite.org` (the verified Lovable subdomain).
- But the visible `From:` header uses `noreply@app.churchmanagementsuite.org` (the **root** domain).
- Yahoo enforces DMARC strictly. If the root domain's DMARC record is missing, or is set to `p=reject/quarantine` without `aspf=r`/`adkim=r`, Yahoo silently drops or bulk-folders mail whose signing domain ≠ From domain — even after Mailgun accepts it.

## Fix

Change the `From:` address to use the same subdomain that already signs the mail, so DKIM/SPF/DMARC align natively without any DNS change.

### Files to edit

1. `supabase/functions/send-transactional-email/index.ts`
   - Change `FROM_DOMAIN` constant (line 16) from `"app.churchmanagementsuite.org"` to `"notify.app.churchmanagementsuite.org"`.

2. `supabase/functions/send-course-registration-email/index.ts`
   - Change `FROM_DOMAIN` constant (line 15) the same way.

Result: emails will be sent from `noreply@notify.app.churchmanagementsuite.org`, matching the signing/sender domain. This is the standard, best-deliverability configuration for subdomain-delegated Lovable Emails.

### Deploy

Deploy both edge functions after the edit:
- `send-transactional-email`
- `send-course-registration-email`

### Verification

After deploy, trigger one exam-link send and one registration confirmation to the Yahoo address and confirm arrival. If mail still doesn't land in the inbox, the next step (out of scope of this plan) is to add/adjust a DMARC TXT record on `app.churchmanagementsuite.org` with a relaxed alignment policy — but the change above resolves the alignment issue without touching DNS.

### Out of scope

- No DNS changes.
- No template, queue, retry, or logging changes.
- Not re-triggering the 92 historical DLQ messages.
