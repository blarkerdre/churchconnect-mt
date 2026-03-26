

## Tenant Isolation Compliance for App Email Infrastructure

### Current State

The existing email functions (`send-email-alert`, `send-welcome-email`, `notify-followup-assignment`, etc.) already handle tenant isolation by:
- Accepting `tenant_id` in the request body
- Filtering member queries with `.eq("tenant_id", tenant_id)`
- Pulling tenant-specific branding (sender name, church name) from the `tenants` table
- Logging `tenant_id` in `email_send_log`

### What the Scaffolded Infrastructure Does

The `send-transactional-email` Edge Function scaffolded by the platform is a **generic template sender** -- it receives a `recipientEmail`, `templateName`, and `templateData`. It does NOT query the members table or any tenant-scoped data directly. The caller (your app code) is responsible for:
- Determining the recipient (already tenant-scoped via your existing queries)
- Passing the correct `tenant_id` and branding data in `templateData`

### Tenant Isolation Gaps to Address During Setup

1. **`email_send_log` tenant tracking**: The scaffolded function logs sends but may not include `tenant_id`. We will modify it post-scaffold to accept and log `tenant_id` from the request body, matching the pattern used by existing functions.

2. **Suppression table is global**: `suppressed_emails` and `email_unsubscribe_tokens` are keyed by email address only -- not by tenant. This is **intentional and correct**: if someone unsubscribes or bounces, that's an email-level signal, not tenant-specific. Sending to a bounced address from any tenant would damage the shared domain's reputation.

3. **Email Dashboard filtering**: The Email Dashboard page should filter `email_send_log` by `tenant_id` so tenant admins only see their own church's email history.

### Plan

1. **Set up email infrastructure** (queues, tables, cron) via the platform tool
2. **Scaffold transactional email functions** (send, unsubscribe, suppression)
3. **Modify `send-transactional-email`** to accept `tenant_id` in the request body and pass it to `email_send_log` inserts
4. **Create a starter template** with tenant-aware branding (church name, colors from `templateData`)
5. **Wire up triggers** in app code using `tenantId` from `useTenantQuery()` in every `supabase.functions.invoke('send-transactional-email', ...)` call
6. **Create unsubscribe page** with app-consistent styling
7. **Deploy all Edge Functions**

### What's Already Tenant-Safe (No Changes Needed)

- Member queries in `send-email-alert` -- already filtered by `tenant_id`
- Notification emails (`notify-followup-assignment`, `notify-pastoral-assignment`) -- already receive and use `tenant_id`
- `process-email-queue` dispatcher -- processes all queued emails regardless of tenant (correct behavior; tenant isolation happens at enqueue time)
- Suppression/unsubscribe -- global by design (protects the shared sending domain)

### Summary

Yes, the infrastructure will comply with tenant isolation. The key principle: **isolation is enforced at the point of triggering** (your app code scopes data by tenant before invoking the email function), not inside the generic email sender. The sender just delivers what it's told to deliver. We add `tenant_id` to logging for audit/dashboard filtering.

