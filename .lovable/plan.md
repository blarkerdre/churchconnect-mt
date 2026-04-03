

## SMS & WhatsApp Quota Management Per Tenant

### Problem
There is no mechanism to set, enforce, or monitor SMS/WhatsApp message limits per tenant. The `tenants` table has `member_limit` and `storage_limit_mb` but no messaging quotas. The `send-sms` edge function sends without checking any limit.

### Solution
Add per-tenant monthly SMS and WhatsApp quotas with enforcement in the edge function, monitoring in Tenant Admin, and usage visibility in Settings.

### Changes

#### 1. Database Migration
Add two columns to the `tenants` table:
- `sms_limit_monthly` (integer, default 0 = unlimited)
- `whatsapp_limit_monthly` (integer, default 0 = unlimited)

Create a database function `get_tenant_message_usage(_tenant_id uuid, _month_start timestamptz)` that counts rows from `sms_log` for the given tenant and month, grouped by channel, returning `{sms_count, whatsapp_count}`.

#### 2. Edge Function — Enforce Limits (`supabase/functions/send-sms/index.ts`)
Before sending, query the tenant's limits and current month usage:
- If `sms_limit_monthly > 0` and `current_sms_count + recipients.length > sms_limit_monthly`, return 403 with a clear error message showing remaining quota
- Same logic for WhatsApp using `whatsapp_limit_monthly`
- Include remaining quota in the success response

#### 3. Tenant Admin — Configure Limits (`src/pages/TenantAdmin.jsx`)
In the tenant edit form (alongside `member_limit` and `storage_limit_mb`):
- Add "Monthly SMS Limit" and "Monthly WhatsApp Limit" number inputs
- 0 = unlimited
- Save to tenants table

Also update `PLAN_TIERS` defaults:
- Free: 50 SMS, 50 WhatsApp
- Starter: 500 SMS, 500 WhatsApp
- Growth: 2000 SMS, 2000 WhatsApp
- Enterprise: 0 (unlimited)

#### 4. Tenant Analytics — Monitor Usage (`src/components/tenants/TenantAnalyticsTab.jsx`)
Add SMS and WhatsApp usage counts (current month) per tenant with progress bars against limits, matching the existing member/storage usage pattern.

#### 5. Settings Page — Usage Visibility (`src/pages/Settings.jsx`)
Show tenant admins their current month SMS/WhatsApp usage vs limit (progress bar + count), so they know how many messages remain.

#### 6. SMS Dialog — Pre-send Warning (`src/components/sms/SMSDialog.jsx`)
Before sending, check remaining quota. If sending would exceed the limit, show a warning with the remaining count and prevent the send.

### Technical Detail

**Usage counting query pattern:**
```sql
SELECT
  count(*) FILTER (WHERE channel = 'sms' AND status = 'sent') as sms_sent,
  count(*) FILTER (WHERE channel = 'whatsapp' AND status = 'sent') as wa_sent
FROM sms_log
WHERE tenant_id = _tenant_id
  AND created_at >= date_trunc('month', now())
```

**Edge function enforcement (in send-sms):**
```typescript
const { data: tenant } = await serviceClient
  .from("tenants")
  .select("sms_limit_monthly, whatsapp_limit_monthly, settings")
  .eq("id", tenant_id)
  .single();

if (msgChannel === "sms" && tenant.sms_limit_monthly > 0) {
  const { count } = await serviceClient.from("sms_log")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .eq("channel", "sms")
    .eq("status", "sent")
    .gte("created_at", monthStart);
  if ((count || 0) + recipients.length > tenant.sms_limit_monthly) {
    return Response(JSON.stringify({ error: `SMS quota exceeded. ${tenant.sms_limit_monthly - (count||0)} remaining this month.` }), { status: 403 });
  }
}
```

### Files changed
- **Database migration** — add `sms_limit_monthly`, `whatsapp_limit_monthly` columns to `tenants`; add `get_tenant_message_usage` function
- `supabase/functions/send-sms/index.ts` — add quota enforcement before sending
- `src/pages/TenantAdmin.jsx` — add SMS/WhatsApp limit inputs in tenant edit form and plan tier defaults
- `src/components/tenants/TenantAnalyticsTab.jsx` — add SMS/WhatsApp usage metrics
- `src/pages/Settings.jsx` — show current month usage vs limit for tenant admins
- `src/components/sms/SMSDialog.jsx` — pre-send quota check with warning

