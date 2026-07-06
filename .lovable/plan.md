## Problem

On **Certificate Approvals**, the "Signposted By" column always shows "—" even when `training_attendees.signposted_by` is populated.

## Root cause

`src/pages/CertificateApprovals.jsx` fetches from `profiles` incorrectly:

```js
supabase.from("profiles")
  .select("id, first_name, last_name, email")
  .in("id", signposterIds);
```

Two bugs:

1. **Wrong join column.** `signposted_by` stores an auth user id, which matches `profiles.user_id`, not `profiles.id`. So no rows are returned.
2. **Non-existent columns.** The `profiles` table has `full_name` and `email` — there is no `first_name` / `last_name`. The select errors out (the working `SignPostInboxDialog` already uses `user_id` + `full_name`).

Result: `profileMap` is empty → cell renders `"—"`, and CSV/Print show the same.

## Fix

Edit `src/pages/CertificateApprovals.jsx`:

- Change the profiles query to:
  ```js
  supabase.from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", signposterIds);
  ```
- Rebuild `profileMap` keyed by `p.user_id`, value `p.full_name || p.email || "—"`.

No schema, RLS, or other module changes required. Table cell, CSV export, and Print output start showing the signposter's name automatically.

## Verification

- Open Certificate Approvals with at least one signposted attendee.
- Confirm the "Signposted By" column shows the referrer's name.
- Export CSV and Print — same value appears.