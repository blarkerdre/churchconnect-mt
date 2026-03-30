

## Fix: Payment Redirect Not Working

### Root cause
Two issues in the payment flow:

1. **Preview iframe blocks external redirects**: `window.location.href` to Stripe's checkout URL is blocked inside the Lovable preview iframe. Must use `window.open(url, "_blank")` instead, or better yet, use `window.top.location.href` to navigate the top frame.

2. **Silent error swallowing**: The `catch` block in `handlePayNow` only logs to console — no toast/feedback is shown to the user, so if the edge function returns an error (e.g. "No active subscription found"), the button just stops loading with no explanation.

3. **Redundant Authorization header**: `supabase.functions.invoke` already sends the auth token automatically. Passing it manually in `headers` can conflict with the SDK's default behavior and may cause the edge function to receive malformed auth.

### Changes

#### 1. Fix `PaymentRequiredScreen.jsx` — `handlePayNow`
- Remove the manual `headers: { Authorization: ... }` — the SDK handles this
- Change `window.location.href = url` to `window.open(url, "_blank")` (works in both iframe and standalone)
- Add a toast error message in the catch block so users see what went wrong

#### 2. Fix `TenantBillingTab.jsx` — any "Pay Now" button there
- Apply same fixes: remove manual auth header, use `window.open`, add error toasts

#### 3. Fix `Settings.jsx` — billing "Pay Now" button
- Apply same pattern

### Technical detail
- `supabase.functions.invoke("create-tenant-checkout", { body: { tenant_id } })` — no custom headers needed
- `window.open(data.url, "_blank")` — opens Stripe checkout in a new tab, works in iframes
- Add `toast({ variant: "destructive", title: "Payment Error", description: err.message })` in catch

### Files changed
1. `src/components/tenants/PaymentRequiredScreen.jsx`
2. `src/components/tenants/TenantBillingTab.jsx` (if it has a pay button)
3. `src/pages/Settings.jsx` (if it has a pay button)

