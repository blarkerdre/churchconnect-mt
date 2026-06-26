# Why Ubani's birthday email is showing "dlq"

## What happened

The birthday email to `ubanibling@gmail.com` was enqueued at 07:00 on 26 Jun, but the send attempt failed with:

```
403 domain_not_verified — "Email domain is not verified for this project"
```

After retries it was moved to the dead-letter queue (`dlq`). The same thing happened yesterday to `kennedarean@yahoo.com`. Birthday emails before 23 Jun went out fine, so something changed in the last few days.

## Root cause (not a code bug)

Your sender domain `notify.app.churchmanagementsuite.org` is currently in **Drifted** status — it was verified before, but DNS verification is no longer passing. Until it's back to verified, every outbound email (birthday, follow-up, auth, etc.) will fail with the same 403 and end up in DLQ.

Expected DNS records at your domain provider (Cloudflare/registrar for `churchmanagementsuite.org`):

| Type | Host | Value |
|------|------|-------|
| TXT | `_lovable-email.app.churchmanagementsuite.org` | `lovable_email_verify=e10cc24f013f6a3e0af40efad634fcf06819...` |
| NS  | `notify.app.churchmanagementsuite.org` | `ns5.lovable.cloud` |
| NS  | `notify.app.churchmanagementsuite.org` | `ns6.lovable.cloud` |

## What you need to do

1. Open **Cloud → Emails → Manage Domains** and compare the records above with what's at your DNS provider.
2. **If they differ / are missing** (most likely — a record was removed or edited): fix them at your DNS provider, then click **Verify Domain**. Propagation can take a few minutes to a few hours.
3. **If they match exactly:** the issue is on Lovable's side — contact Lovable support to re-provision `notify.app.churchmanagementsuite.org`. Don't loop on Verify.

## After it's verified

- New birthday/auth/app emails will send normally.
- The DLQ'd messages (Ubani's, Kennedarean's) won't auto-replay. If you want them resent, I can add a small admin action to re-trigger today's birthday send for specific members — say the word and I'll plan that as a separate change.

## Code change required

None. This is purely a DNS/domain-verification issue.
