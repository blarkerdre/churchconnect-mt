# Restrict payment-due notifications to admins/owners

Audit shows payment-related surfaces are inconsistently scoped. Banner is already gated, but two other surfaces leak to regular members:

1. **`PaymentRequiredScreen` (suspension lockout)** — `src/components/AppLayout.jsx:188` currently blocks the entire app for **every** user of a suspended tenant. A regular member sees a billing screen they can't act on.
2. **In-app notifications backlog** — DB check shows a `member`-role user has a "Payment Overdue" notification (likely role changed after insert). Going forward we'll keep insert-time filtering and add a defensive read-time guard.
3. **Banner** (`AppLayout.jsx:424`) — already correctly gated to `isTenantAdmin || isTenantOwner`. No change.
4. **Notification inserts** in `check-tenant-payments` and `stripe-subscription-webhook` — already filter `role in ('owner','admin')`. No change.

## Changes

### `src/components/AppLayout.jsx`
- Gate the `PaymentRequiredScreen` lockout to admins/owners only:
  ```
  if (subscriptionStatus === "suspended" && !isSuperAdmin && (isTenantAdmin || isTenantOwner)) {
    return <PaymentRequiredScreen />;
  }
  ```
- Regular members of a suspended tenant continue to use the app normally (the tenant owner is the one who needs to act on billing).

### `src/components/notifications/NotificationBell.jsx`
- In the notifications query, filter out `type = "billing"` entries when the current user is not `isTenantAdmin`/`isTenantOwner`. This hides any legacy/stale billing notifications from non-admin members. Add `.or(...)` clause or post-filter the array — post-filter is simplest:
  ```
  const visible = notifications.filter(n => n.type !== "billing" || isTenantAdmin || isTenantOwner);
  ```
  Use `visible` for rendering and `unreadCount`.

### Data cleanup (optional, one-off migration)
- Delete existing `type='billing'` notifications belonging to users whose current tenant role is `member`. Single small migration; safe because these users can't act on them anyway.

## Out of scope
- The `PaymentWarningBanner` gating (already correct).
- Edge-function notification inserts (already correctly scoped to owner/admin).
- Email/SMS billing alerts (none exist).
