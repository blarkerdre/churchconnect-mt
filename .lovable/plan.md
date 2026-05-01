## Goal

Only show the "Payment Overdue" warning banner to tenant admins and owners. Regular members should not see billing warnings.

## Current Behaviour

In `src/components/AppLayout.jsx` (line 398), the `PaymentWarningBanner` renders for **every** non-super-admin user when `subscriptionStatus === "past_due"`:

```jsx
{subscriptionStatus === "past_due" && !isSuperAdmin && (
  <PaymentWarningBanner />
)}
```

This means regular members see a banner urging them to "Pay Now" — which they have no permission or context to act on.

## Change

Add an `(isTenantAdmin || isTenantOwner)` gate. Both flags are already destructured from `useAuth()` on line 66, so no new imports/hooks needed.

```jsx
{subscriptionStatus === "past_due" && !isSuperAdmin && (isTenantAdmin || isTenantOwner) && (
  <PaymentWarningBanner />
)}
```

## Files Changed

- `src/components/AppLayout.jsx` — single-line condition update on line 398.

## Notes

- Suspended-state full-screen block (`PaymentRequiredScreen` at line 172) already restricts actions for everyone when suspended; that is intentional and unchanged — members still need to know the church account is suspended. Only the soft "past_due" warning banner is being scoped to admins/owners.
- The billing notifications sent by `check-tenant-payments` already only target `owner`/`admin` roles, so this aligns the in-app UI with the existing notification policy.