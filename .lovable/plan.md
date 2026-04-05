

## Payment History View + Payment Receipt Emails

### Changes

#### 1. Settings Page — Enhanced Payment History (`src/pages/Settings.jsx`)
Expand the existing "Recent Payments" section (lines 233-245) into a full payment history view:
- Show all payments (remove limit 10, or increase to 50)
- Add a proper table with columns: Date, Amount, Method, Status, Reference
- Add status badges (completed = green, pending = amber, failed = red)
- Add a "View All" toggle or scrollable container
- Show payment reference/invoice ID when available

#### 2. Payment Receipt Email Template (`supabase/functions/_shared/transactional-email-templates/payment-receipt.tsx`)
Create a new transactional email template:
- Church name, payment date, amount, currency, billing cycle
- Payment method, reference/invoice ID
- Next due date
- "Manage Subscription" link to settings page
- Follows existing styling (navy #1e3a5f, cream #faf6f0)

#### 3. Register Template in Registry (`supabase/functions/_shared/transactional-email-templates/registry.ts`)
Add `'payment-receipt': paymentReceipt` to the TEMPLATES map.

#### 4. Webhook — Send Receipt Email (`supabase/functions/stripe-subscription-webhook/index.ts`)
In the `invoice.payment_succeeded` handler (after recording the payment):
- Look up tenant name and admin emails from `tenant_memberships` + `profiles`
- Call `send-transactional-email` with the `payment-receipt` template
- Include amount, currency, payment date, reference, next due date, and tenant name
- Non-blocking: wrap in try/catch so email failure doesn't break payment recording

#### 5. Deploy Edge Functions
Redeploy `stripe-subscription-webhook` and `send-transactional-email` after changes.

### Technical Details

**Receipt email trigger (in webhook):**
```typescript
// After recording payment successfully
const { data: tenantInfo } = await supabaseAdmin
  .from("tenants").select("name, slug").eq("id", tenantId).single();

const { data: admins } = await supabaseAdmin
  .from("tenant_memberships")
  .select("user_id, profiles!inner(email, full_name)")
  .eq("tenant_id", tenantId)
  .in("role", ["owner", "admin"]);

for (const admin of admins || []) {
  await supabaseAdmin.functions.invoke("send-transactional-email", {
    body: {
      templateName: "payment-receipt",
      to: admin.profiles.email,
      data: { name, churchName, amount, currency, paymentDate, reference, nextDueDate }
    }
  });
}
```

### Files changed
- `src/pages/Settings.jsx` — expand payment history into table view with all columns
- `supabase/functions/_shared/transactional-email-templates/payment-receipt.tsx` — new receipt template
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register template
- `supabase/functions/stripe-subscription-webhook/index.ts` — send receipt email on successful payment

